import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'
import type { Campaign, Destination, Media } from '../payload-types'
import { parseCSV } from '../lib/csv.ts'
import { planImport } from '../lib/import-records.ts'
import { validateTransition } from '../lib/lifecycle.ts'
import { cmsToDeparture } from './normalize.ts'
import { importRemoteMedia } from './media-import.ts'
import { normalizeMTPE, relationID, sharedData } from '../lib/programs.ts'
import { inTransaction } from './transactions.ts'
import { normalize } from '../lib/catalog.ts'

export async function importCSV(payload: Payload, csv: string, req: PayloadRequest, options: { dryRun: boolean; downloadImages: boolean; historical?: boolean }) {
  const previousContext = req.context
  try {
  const rows = parseCSV(csv)
  if (rows.length > 5000) throw new Error('El límite por archivo es de 5000 filas.')
  const plan = planImport(rows, { historical: options.historical })
  const results: { row: number; status: string; id?: string | number; message?: string }[] = plan.errors.map(e => ({ row: e.row, status: 'error', message: e.error }))
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
      let programRef: number | string | undefined
      for (const { row, item } of entries) {
      const existing = await payload.find({ collection: 'departures', overrideAccess: false, req, depth: 0, limit: 1, where: { sourceKey: { equals: item.sourceKey } } })
      const original = existing.docs[0]
      if (original?.status === 'withdrawn' && item.status === 'published') throw new Error('Esta salida está retirada en el CMS. Reactívala después de revisar precio, enlaces y vigencia.')
      if (original) {
        const transitionErrors = validateTransition(cmsToDeparture(original), item, { historicalImport: options.historical })
        if (transitionErrors.length) throw new Error(transitionErrors.join(' '))
      }
      if (options.dryRun) {
        const candidates = await payload.find({ collection: 'departures', req, overrideAccess: false, depth: 1, pagination: false, where: { mtpe: { equals: item.mtpe } } })
        if (candidates.docs.some(doc => doc.id !== original?.id && normalize(cmsToDeparture(doc).origin) === normalize(item.origin) && doc.travelDate === item.travelDate)) throw new Error('Ya existe una salida para este MTPE, origen y fecha.')
        groupResults.push({ row, status: original ? 'would-update' : 'would-create' }); continue
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
        program: item.program, mtpe: item.mtpe, destination, origin, zone: item.zone, cruiseLine, days: item.days, nights: item.nights,
        travelDate: item.travelDate, price: item.price, currency: item.currency, priceCondition: item.priceCondition,
        flyer, flyerSourceUrl: item.flyerUrl.startsWith('https://') ? item.flyerUrl : '', flyerDownloadWarning: warning ? 'Se conserva el enlace original. ' + warning : '', bookingUrl: item.bookingUrl, descriptionUrl: item.descriptionUrl,
        promotions: promotionIds, priority: item.priority, advanceDays: item.advanceDays, status: item.status,
        withdrawalReason: original?.status === 'withdrawn' ? original.withdrawalReason : item.withdrawalReason,
        withdrawalNote: original?.status === 'withdrawn' ? original.withdrawalNote : item.withdrawalNote, sourceKey: item.sourceKey || null,
        sourceSheet: item.sourceSheet, sourceRef: item.sourceRef,
        sourceRetirementDate: item.sourceRetirementDate, sourceRetirementRaw: item.sourceRetirementRaw,
        ...(options.historical && !original ? { retiredAt: item.retiredAt || null } : {}),
      }
      const context = { historicalImport: options.historical === true, skipMediaDownload: true }
      if (!programRef) {
        const found = await payload.find({ collection: 'programs', req, overrideAccess: false, depth: 0, limit: 1, where: { mtpe: { equals: normalizeMTPE(item.mtpe) } } })
        const common = sharedData(data) as RequiredDataFromCollectionSlug<'programs'>
        if (!flyer && found.docs[0]?.flyerSourceUrl === data.flyerSourceUrl) common.flyer = relationID(found.docs[0].flyer) as any
        const program = found.docs[0] ? await payload.update({ collection: 'programs', id: found.docs[0].id, req, overrideAccess: false, data: common, context }) : await payload.create({ collection: 'programs', req, overrideAccess: false, data: common, context })
        programRef = program.id
      }
      data.programRef = programRef as any
      const doc = original ? await payload.update({ collection: 'departures', id: original.id, overrideAccess: false, req, data, context }) : await payload.create({ collection: 'departures', overrideAccess: false, req, data, context })
      groupResults.push({ row, status: original ? 'updated' : 'created', id: doc.id, ...(warning ? { message: 'Se conserva el enlace del flyer: ' + warning } : {}) })
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
