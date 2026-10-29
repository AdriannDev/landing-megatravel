import { randomUUID } from 'node:crypto'
import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import { retirementAt, validateTransition, isPublishable } from '../lib/lifecycle'
import { cmsToDeparture } from './normalize'
import { departureKey, normalizeMTPE, relationID, sharedData } from '../lib/programs.ts'
import { prepareSeatReference } from '../lib/availability.ts'

export const prepareDeparture: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req, context }) => {
  if (operation === 'create') {
    data.stableId = randomUUID()
    data.sourceKey ||= 'cms:' + data.stableId
  }
  if (!context.sharedProjection) {
    try { Object.assign(data, prepareSeatReference(data, operation === 'update' ? originalDoc : undefined)) }
    catch (error) { throw new APIError((error as Error).message, 400) }
    const combined = { ...originalDoc, ...data }
    let programID = relationID(combined.programRef)
    if (!programID) {
      const found = await req.payload.find({ collection: 'programs', req, overrideAccess: true, depth: 0, limit: 1, where: { mtpe: { equals: normalizeMTPE(combined.mtpe) } } })
      const program = found.docs[0] || await req.payload.create({ collection: 'programs', req, overrideAccess: true, data: sharedData(combined) as any, context: { skipMediaDownload: context.skipMediaDownload } })
      programID = program.id
    }
    const program = await req.payload.findByID({ collection: 'programs', id: programID, req, overrideAccess: true, depth: 0 })
    Object.assign(data, sharedData(program), { programRef: program.id })
    const key = departureKey(program.mtpe, combined.origin, combined.travelDate)
    const duplicates = await req.payload.find({ collection: 'departures', req, overrideAccess: true, depth: 0, limit: 1, where: { and: [{ mtpe: { equals: program.mtpe } }, { origin: { equals: relationID(combined.origin) } }, { travelDate: { equals: combined.travelDate } }, ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : [])] } })
    if (duplicates.docs.length && (operation === 'create' || key !== departureKey(originalDoc?.mtpe, originalDoc?.origin, originalDoc?.travelDate))) throw new APIError('Ya existe una salida para este MTPE, origen y fecha.', 409)
    data.departureKey = duplicates.docs.length ? originalDoc?.departureKey ?? null : key
  }
  const combined = { ...originalDoc, ...data }
  if (context.sharedProjection) return data
  if (context.automaticRetirement && isPublishable({ ...combined, status: 'published' })) throw new APIError('La salida volvió a estar vigente; no se retiró.', 409)
  if (combined.travelDate) data.withdrawalAt = retirementAt(combined.travelDate, combined.advanceDays ?? 30)
  const errors = validateTransition(originalDoc ? cmsToDeparture(originalDoc) : undefined, cmsToDeparture(combined), {
    reviewConfirmed: data.reviewConfirmed === true,
    automatic: context.automaticRetirement === true,
    historicalImport: context.historicalImport === true,
  })
  if (errors.length) throw new APIError(errors.join(' '), 400)
  if (combined.status === 'withdrawn' && originalDoc?.status !== 'withdrawn' && !context.historicalImport) {
    data.retiredAt = new Date().toISOString()
    data.retiredBy = req.user?.id || null
  }
  data.reviewConfirmed = false
  return data
}

const tracked = ['program', 'mtpe', 'destination', 'zone', 'origin', 'cruiseLine', 'days', 'nights', 'travelDate', 'price', 'currency', 'priceCondition', 'flyer', 'flyerSourceUrl', 'bookingUrl', 'descriptionUrl', 'promotions', 'priority', 'advanceDays', 'status', 'withdrawalReason', 'withdrawalNote', 'availableSeats', 'lastSeats', 'seatsCheckedAt']
const compact = (value: unknown): unknown => Array.isArray(value) ? value.map(compact) : value && typeof value === 'object' && 'id' in value ? value.id : value ?? null
export const recordDepartureAudit: CollectionAfterChangeHook = async ({ doc, previousDoc, req, operation, context }) => {
  const changes = Object.fromEntries(tracked.filter(key => JSON.stringify(compact(doc[key])) !== JSON.stringify(compact(previousDoc?.[key]))).map(key => [key, { before: compact(previousDoc?.[key]), after: compact(doc[key]) }]))
  if (previousDoc?.status === 'withdrawn' && doc.status === 'published') changes.reviewConfirmed = { before: false, after: true }
  if (!Object.keys(changes).length) return doc
  const event = operation === 'create' ? 'created' : doc.status === 'withdrawn' && previousDoc?.status !== 'withdrawn' ? 'withdrawn' : doc.status === 'published' && previousDoc?.status === 'withdrawn' ? 'reactivated' : 'updated'
  await req.payload.create({ collection: 'audit-log', overrideAccess: true, req, data: {
    departureId: String(doc.stableId), program: doc.program, event, changes,
    actor: req.user?.id || null,
    actorLabel: req.user?.email || (context.automaticRetirement ? 'Sistema: retiro automático' : context.historicalImport ? 'Importación histórica (responsable original no disponible)' : 'Importación autorizada'),
  } })
  return doc
}
