import { createHmac, timingSafeEqual } from 'node:crypto'
import { APIError, type CollectionBeforeDeleteHook, type PayloadRequest } from 'payload'
import { inTransaction, lockCommercialRecords, lockSeatWrites } from './transactions.ts'

export type DeletionCollection = 'programs' | 'departures'
function admin(req: PayloadRequest) {
  if (req.user?.role !== 'admin') throw new APIError('Solo un administrador puede eliminar estos registros.', 403)
}
function selectedIDs(value: unknown): (string | number)[] {
  if (!Array.isArray(value) || !value.length || value.length > 200 || value.some(id => !['string', 'number'].includes(typeof id) || !String(id).trim())) throw new APIError('Selecciona entre 1 y 200 registros.', 400)
  return [...new Map(value.map(id => [String(id), id])).values()]
}
async function selection(req: PayloadRequest, collection: DeletionCollection, ids: unknown) {
  admin(req)
  const selected = selectedIDs(ids)
  const records = await req.payload.find({ collection, req, overrideAccess: false, depth: 0, pagination: false, sort: 'id', where: { id: { in: selected } } })
  if (records.docs.length !== selected.length) throw new APIError('Un registro ya no existe. Actualiza la selección.', 409)
  const departures = collection === 'programs' ? (await req.payload.find({ collection: 'departures', req, overrideAccess: false, depth: 0, pagination: false, sort: 'id', where: { programRef: { in: selected } } })).docs : []
  return { records: records.docs, departures }
}
function signature(req: PayloadRequest, collection: DeletionCollection, data: unknown, preparedAt: number) {
  return createHmac('sha256', req.payload.config.secret).update(JSON.stringify({ user: req.user!.id, collection, data, preparedAt })).digest('hex')
}
export async function deletionPreview(req: PayloadRequest, collection: DeletionCollection, ids: unknown) {
  const data = await selection(req, collection, ids), preparedAt = Date.now()
  return { programs: collection === 'programs' ? data.records.length : 0, departures: collection === 'programs' ? data.departures.length : data.records.length,
    names: data.records.map(doc => doc.program), preparedAt, token: signature(req, collection, data, preparedAt) }
}
export async function deleteSelection(req: PayloadRequest, collection: DeletionCollection, ids: unknown, confirmation: { token?: unknown; preparedAt?: unknown }) {
  admin(req)
  return inTransaction(req, async () => {
    await lockSeatWrites(req)
    await lockCommercialRecords(req, collection, selectedIDs(ids))
    if (collection === 'programs') {
      const children = await req.payload.find({ collection: 'departures', req, overrideAccess: false, depth: 0, pagination: false, where: { programRef: { in: selectedIDs(ids) } } })
      await lockCommercialRecords(req, 'departures', children.docs.map(doc => doc.id))
    }
    const data = await selection(req, collection, ids)
    const { token, preparedAt } = confirmation
    if (typeof preparedAt !== 'number' || Date.now() - preparedAt > 15 * 60_000 || preparedAt > Date.now() || typeof token !== 'string') throw new APIError('La confirmación venció. Consulta de nuevo el resumen.', 409)
    const expected = signature(req, collection, data, preparedAt)
    if (!/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) throw new APIError('Los registros cambiaron. Consulta de nuevo el resumen antes de eliminar.', 409)
    const previous = req.context.confirmedProgramDeletion
    req.context.confirmedProgramDeletion = true
    try {
      for (const doc of data.records) await req.payload.delete({ collection, id: doc.id, req, overrideAccess: false })
    } finally { req.context.confirmedProgramDeletion = previous }
    return { programs: collection === 'programs' ? data.records.length : 0, departures: collection === 'programs' ? data.departures.length : data.records.length }
  })
}
export const recordProgramDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  admin(req)
  if (!req.context.confirmedProgramDeletion) throw new APIError('Utiliza «Eliminar programa» para confirmar el número de salidas afectadas.', 400)
  await lockSeatWrites(req)
  await lockCommercialRecords(req, 'programs', [id])
  const program = await req.payload.findByID({ collection: 'programs', id, req, overrideAccess: false, depth: 0 })
  const children = await req.payload.find({ collection: 'departures', req, overrideAccess: false, depth: 0, pagination: false, where: { programRef: { equals: id } } })
  for (const doc of children.docs) await req.payload.delete({ collection: 'departures', id: doc.id, req, overrideAccess: false })
  await req.payload.create({ collection: 'audit-log', req, overrideAccess: true, data: {
    entityType: 'program', programId: String(id), program: program.program, event: 'deleted', actor: req.user!.id,
    actorLabel: req.user!.email || 'Administrador', changes: { deleted: { before: program, after: null }, departuresDeleted: children.docs.length },
  } })
}
