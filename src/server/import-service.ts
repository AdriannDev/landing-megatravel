import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'
import type { Campaign, Destination, Media } from '../payload-types'
import { parseCSV } from '../lib/csv.ts'
import { planImport } from '../lib/import-records.ts'
import { validateTransition } from '../lib/lifecycle.ts'
import { cmsToDeparture } from './normalize.ts'
import { importRemoteMedia } from './media-import.ts'
import { normalizeMTPE, relationID, sharedData } from '../lib/programs.ts'
import { inTransaction, lockSeatWrites } from './transactions.ts'
import { normalize } from '../lib/catalog.ts'
import { equalProof, seatProof, seatVersion } from './seat-assignment.ts'
import { createHash } from 'node:crypto'

export async function importCSV(payload: Payload, csv: string, req: PayloadRequest, options: { dryRun: boolean; downloadImages: boolean; historical?: boolean; seatsConfirmed?: boolean; validationTokens?: Record<string, string> }) {
  const previousContext = req.context
  try {
  const rows = parseCSV(csv)
  if (rows.length > 5000) throw new Error('El límite por archivo es de 5000 filas.')
  const plan = planImport(rows, { historical: options.historical })
  const results: { row: number; status: string; id?: string | number; message?: string; availableSeats?: number | null; lastSeats?: boolean; validationToken?: string }[] = plan.errors.map(e => ({ row: e.row, status: 'error', message: e.error }))
  const references = new Map<string, Destination['id']>(), media = new Map<string, Media['id']>(), failedMedia = new Map<string, string>()
  async function reference(collection: 'destinations' | 'origins' | 'cruise-lines', name: string) {
    const key = collection + ':' + name
    if (references.has(key)) return references.get(key)!
    const found = await payload.find({ collection, overrideAccess: false, req, pagination: false, depth: 0 })
    const doc = found.docs.find(doc => normalize(doc.name) === normalize(name)) || await payload.create({ collection, overrideAccess: false, req, data: { name: name.trim() } })
    references.set(key, doc.id)
    return doc.id
  }
  const programs = new Map<string, (typeof plan.accepted)>()
  for (const entry of plan.accepted) programs.set(entry.item.mtpe, [...(programs.get(entry.item.mtpe) || []), entry])
  for (const entries of programs.values()) {
    const groupResults: typeof results = []
    try {
      const run = async () => {
      if (!options.dryRun) await lockSeatWrites(req)
      let programRef: number | string | undefined
      let sharedDestination: number | string | null = null
      let sharedBookingUrl = ''
      const defaults = await payload.find({ collection: 'programs', req, overrideAccess: false, depth: 0, limit: 1, where: { mtpe: { equals: normalizeMTPE(entries[0].item.mtpe) } } })
      const initial = defaults.docs[0]
      // Snapshot all rows before this group's own shared-content projections change updatedAt.
      const originals = new Map<string, any>()
      for (const { item } of entries) {
        const found = await payload.find({ collection: 'departures', overrideAccess: false, req, depth: 0, limit: 1, where: { sourceKey: { equals: item.sourceKey } } })
        originals.set(item.sourceKey!, found.docs[0])
      }
      for (const { row, item } of entries) {
      const original = originals.get(item.sourceKey!)
      if (original?.status === 'withdrawn' && item.status === 'published') throw new Error('Esta salida está retirada en el CMS. Reactívala después de revisar precio, enlaces y vigencia.')
      if (original) {
        const transitionErrors = validateTransition(cmsToDeparture(original), item, { historicalImport: options.historical })
        if (transitionErrors.length) throw new Error(transitionErrors.join(' '))
      }
      const hasSeats = item.availableSeats !== undefined || item.lastSeats !== undefined
      const effectiveSeats = item.availableSeats !== undefined ? item.availableSeats : original ? original.availableSeats ?? null : initial?.availableSeats ?? null
      const effectiveFlag = effectiveSeats !== 0 && (item.lastSeats ?? (original ? original.lastSeats : initial?.lastSeats)) === true
      const proof = hasSeats ? seatProof(req, ['import-seats', req.user?.id, createHash('sha256').update(csv).digest('hex'), row, seatVersion(original), initial ? [initial.id, initial.availableSeats ?? null, initial.lastSeats === true] : null, effectiveSeats, effectiveFlag]) : undefined
      if (!options.dryRun && hasSeats && (!options.seatsConfirmed || !equalProof(options.validationTokens?.[String(row)], proof!))) throw new Error('Confirma los cupos y vuelve a validar el CSV: el saldo o los valores iniciales pudieron cambiar.')
      if (options.dryRun) {
        const candidates = await payload.find({ collection: 'departures', req, overrideAccess: false, depth: 1, pagination: false, where: { mtpe: { equals: item.mtpe } } })
        if (candidates.docs.some(doc => doc.id !== original?.id && normalize(cmsToDeparture(doc).origin) === normalize(item.origin) && doc.travelDate === item.travelDate)) throw new Error('Ya existe una salida para este MTPE, origen y fecha.')
        groupResults.push({ row, status: original ? 'would-update' : 'would-create', availableSeats: effectiveSeats, lastSeats: effectiveFlag, ...(proof ? { validationToken: proof } : {}) }); continue
      }
      const destination = await reference('destinations', item.destination)
      const origin = await reference('origins', item.origin)
      const cruiseLine = item.cruiseLine ? await reference('cruise-lines', item.cruiseLine) : null
      const promotionIds: Campaign['id'][] = []
      for (const promo of item.promotions) {
        const found = await payload.find({ collection: 'campaigns', overrideAccess: false, req, limit: 1, where: { slug: { equals: promo.id } } })
        const doc = found.docs[0] || await payload.create({ collection: 'campaigns', overrideAccess: false, req, data: { slug: promo.id, name: promo.name, label: promo.label } })
        promotionIds.push(doc.id)
      }
      let flyer = original?.flyer || null, warning: string | undefined
      if (options.downloadImages && item.flyerUrl.startsWith('https://')) {
        try {
          if (failedMedia.has(item.flyerUrl)) throw new Error(failedMedia.get(item.flyerUrl))
          if (!media.has(item.flyerUrl)) media.set(item.flyerUrl, (await importRemoteMedia(payload, item.flyerUrl, item.program, req)).id)
          flyer = media.get(item.flyerUrl)!
        } catch (error) { warning = (error as Error).message; failedMedia.set(item.flyerUrl, warning) }
      }
      const data: RequiredDataFromCollectionSlug<'departures'> = {
        ...(hasSeats ? { seatsConfirmed: options.seatsConfirmed === true } : {}),
        ...(item.availableSeats !== undefined ? { availableSeats: item.availableSeats } : {}),
        ...(item.lastSeats !== undefined ? { lastSeats: item.lastSeats === true } : {}),
        program: item.program, mtpe: item.mtpe, destination, origin, zone: item.zone, cruiseLine, days: item.days, nights: item.nights,
        travelDate: item.travelDate, price: item.price, currency: item.currency, priceCondition: item.priceCondition,
        flyer, flyerSourceUrl: item.flyerUrl.startsWith('https://') ? item.flyerUrl : '', bookingUrl: item.bookingUrl, descriptionUrl: item.descriptionUrl,
        promotions: promotionIds, priority: item.priority, advanceDays: item.advanceDays, status: item.status,
        withdrawalReason: original?.status === 'withdrawn' ? original.withdrawalReason : item.withdrawalReason,
        withdrawalNote: original?.status === 'withdrawn' ? original.withdrawalNote : item.withdrawalNote, sourceKey: item.sourceKey || null,
        sourceSheet: item.sourceSheet, sourceRef: item.sourceRef,
        sourceRetirementDate: item.sourceRetirementDate, sourceRetirementRaw: item.sourceRetirementRaw,
        ...(options.historical && !original ? { retiredAt: item.retiredAt || null } : {}),
      }
      const context = { historicalImport: options.historical === true, skipMediaDownload: true, reconcileSeats: item.availableSeats !== undefined, seatReviewOnly: hasSeats && item.availableSeats === undefined }
      if (!programRef) {
        const found = await payload.find({ collection: 'programs', req, overrideAccess: false, depth: 0, limit: 1, where: { mtpe: { equals: normalizeMTPE(item.mtpe) } } })
        const common = sharedData(data) as RequiredDataFromCollectionSlug<'programs'>
        if (!flyer && found.docs[0]?.flyerSourceUrl === data.flyerSourceUrl) common.flyer = relationID(found.docs[0].flyer) as any
        const program = found.docs[0] ? await payload.update({ collection: 'programs', id: found.docs[0].id, req, overrideAccess: false, data: common, context }) : await payload.create({ collection: 'programs', req, overrideAccess: false, data: common, context })
        programRef = program.id
        sharedDestination = relationID(program.destination)
        sharedBookingUrl = program.bookingUrl || ''
      }
      data.programRef = programRef as any
      data.destinationOverride = String(destination) !== String(sharedDestination) ? destination : null
      data.bookingUrlOverride = item.bookingUrl !== sharedBookingUrl ? item.bookingUrl : null
      const doc = original ? await payload.update({ collection: 'departures', id: original.id, overrideAccess: false, req, data, context }) : await payload.create({ collection: 'departures', overrideAccess: false, req, data, context })
      groupResults.push({ row, status: original ? 'updated' : 'created', id: doc.id, ...(warning ? { message: 'Se conserva el enlace de la imagen: ' + warning } : {}) })
      }
      }
      if (options.dryRun) await run()
      else await inTransaction(req, run)
      results.push(...groupResults)
    } catch (error) {
      references.clear(); media.clear()
      for (const { row } of entries) results.push({ row, status: 'error', message: (error as Error).message })
    }
  }
  results.sort((a, b) => a.row - b.row)
  return { dryRun: options.dryRun, total: rows.length, accepted: results.filter(r => r.status !== 'error').length, errors: results.filter(r => r.status === 'error').length, results }
  } finally { req.context = previousContext }
}
