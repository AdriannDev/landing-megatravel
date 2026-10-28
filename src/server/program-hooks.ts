import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionAfterReadHook } from 'payload'
import { normalizeMTPE, relationID, sharedData, resolveProgram } from '../lib/programs.ts'
import { isPublishable, validatePublication } from '../lib/lifecycle.ts'
import { cmsToDeparture } from './normalize.ts'
import { importRemoteMedia } from './media-import.ts'

export const prepareProgram: CollectionBeforeChangeHook = async ({ data, originalDoc, req, context }) => {
  data.mtpe = normalizeMTPE(data.mtpe ?? originalDoc?.mtpe)
  const sourceChanged = data.flyerSourceUrl !== undefined && data.flyerSourceUrl !== originalDoc?.flyerSourceUrl
  const explicitUpload = data.flyer && relationID(data.flyer) !== relationID(originalDoc?.flyer)
  if (sourceChanged && !explicitUpload) {
    data.flyer = null
    if (!context.skipMediaDownload) data.flyerDownloadWarning = ''
    if (data.flyerSourceUrl && req.user && !context.skipMediaDownload) {
      try { data.flyer = (await importRemoteMedia(req.payload, data.flyerSourceUrl, data.program || originalDoc?.program || 'Flyer de programa', req)).id }
      catch (error) { data.flyerDownloadWarning = 'Se conserva el enlace original. No se pudo copiar la imagen: ' + (error as Error).message }
    }
  }
  if (originalDoc?.id && !context.programMigration) {
    if (data.mtpe !== originalDoc.mtpe) throw new APIError('El MTPE identifica el programa y no se puede cambiar. Crea otro programa.', 400)
    const previousContext = req.context
    try {
    const departures = await req.payload.find({ collection: 'departures', req, overrideAccess: true, depth: 0, pagination: false, where: { programRef: { equals: originalDoc.id } }, context: { skipProgramResolution: true } })
    for (const departure of departures.docs) {
      if (!isPublishable(departure)) continue
      const errors = validatePublication(cmsToDeparture({ ...departure, ...sharedData({ ...originalDoc, ...data }), programRef: null }))
      if (errors.length) throw new APIError(`Este programa tiene salidas publicadas: ${errors.join(' ')}`, 400)
    }
    } finally { req.context = previousContext }
  }
  return data
}

export const syncProgramSnapshots: CollectionAfterChangeHook = async ({ doc, req, context }) => {
  if (context.programMigration) return doc
  const previousContext = req.context
  try {
  const departures = await req.payload.find({ collection: 'departures', req, overrideAccess: true, depth: 0, pagination: false, where: { programRef: { equals: doc.id } }, context: { skipProgramResolution: true } })
  for (const departure of departures.docs) {
    await req.payload.update({ collection: 'departures', id: departure.id, req, overrideAccess: true, data: sharedData(doc) as any, context: { sharedProjection: true, skipMediaDownload: true, skipProgramResolution: true } })
  }
  return doc
  } finally { req.context = previousContext }
}

export const resolveDepartureProgram: CollectionAfterReadHook = async ({ doc, req, context }) => {
  // Version snapshots have no document ID; keep their historical commercial values.
  if (!doc.id || !doc.programRef || context.skipProgramResolution) return doc
  const id = relationID(doc.programRef)
  const populated = typeof doc.programRef === 'object' && typeof doc.programRef.destination === 'object' && (!doc.programRef.flyer || typeof doc.programRef.flyer === 'object') && (!doc.programRef.cruiseLine || typeof doc.programRef.cruiseLine === 'object')
  const program = populated ? doc.programRef : await req.payload.findByID({ collection: 'programs', id: id!, req, overrideAccess: true, depth: 1 })
  return resolveProgram({ ...doc, programRef: program })
}
