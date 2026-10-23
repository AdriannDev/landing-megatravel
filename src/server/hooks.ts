import { randomUUID } from 'node:crypto'
import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'
import { APIError } from 'payload'
import { retirementAt, validateTransition, isPublishable } from '../lib/lifecycle'
import { cmsToDeparture } from './normalize'
import { importRemoteMedia } from './media-import'

export const prepareDeparture: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req, context }) => {
  if (operation === 'create') {
    data.stableId = randomUUID()
    data.sourceKey ||= 'cms:' + data.stableId
  }
  const sourceChanged = data.flyerSourceUrl !== undefined && data.flyerSourceUrl !== originalDoc?.flyerSourceUrl
  const explicitNewUpload = data.flyer && JSON.stringify(compact(data.flyer)) !== JSON.stringify(compact(originalDoc?.flyer))
  if (sourceChanged && !explicitNewUpload) {
    data.flyer = null
    if (!context.skipMediaDownload) data.flyerDownloadWarning = ''
    if (data.flyerSourceUrl && req.user && !context.skipMediaDownload) {
      try { data.flyer = (await importRemoteMedia(req.payload, data.flyerSourceUrl, data.program || originalDoc?.program || 'Flyer de programa', req)).id }
      catch (error) { data.flyerDownloadWarning = 'Se conserva el enlace original. No se pudo copiar la imagen: ' + (error as Error).message }
    }
  }
  const combined = { ...originalDoc, ...data }
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

const tracked = ['program', 'mtpe', 'destination', 'zone', 'origin', 'cruiseLine', 'days', 'nights', 'travelDate', 'price', 'currency', 'priceCondition', 'flyer', 'flyerSourceUrl', 'bookingUrl', 'descriptionUrl', 'promotions', 'priority', 'advanceDays', 'status', 'withdrawalReason', 'withdrawalNote']
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
