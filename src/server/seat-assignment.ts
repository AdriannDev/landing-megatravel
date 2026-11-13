import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { APIError, type PayloadRequest } from 'payload'
import { validSeatCount } from '../lib/availability.ts'
import { relationID } from '../lib/programs.ts'
import { inTransaction, lockSeatWrites } from './transactions.ts'

// Includes identity and reconciliation so an intervening mail or manual edit invalidates previews.
export const seatVersion = (doc: Record<string, any> | undefined) => createHash('sha256').update(JSON.stringify(doc ? [doc.id, doc.stableId, relationID(doc.programRef), doc.travelDate, relationID(doc.origin), doc.availableSeats ?? null, doc.lastSeats === true, doc.seatsCheckedAt ?? null, doc.seatsReconciledAt ?? null, doc.updatedAt] : null)).digest('hex')
export function seatProof(req: PayloadRequest, value: unknown) {
  return createHmac('sha256', req.payload.config.secret).update(JSON.stringify(value)).digest('hex')
}
export function equalProof(left: unknown, right: string) {
  return typeof left === 'string' && /^[a-f0-9]{64}$/.test(left) && timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'))
}
export type SeatAssignment = {
  action: 'preview' | 'apply'; programId?: string | number; ids?: (string | number)[]
  availableSeats?: number | null; lastSeats?: boolean
  confirmation?: { token: string; preparedAt: number }
}
export async function assignSeats(req: PayloadRequest, input: SeatAssignment) {
  if (!req.user || !['admin', 'editor'].includes(req.user.role)) throw new APIError('Inicia sesión como editor.', 403)
  if (!['preview', 'apply'].includes(input.action)) throw new APIError('Operación no válida.', 400)
  const quantity = Object.hasOwn(input, 'availableSeats'), flag = Object.hasOwn(input, 'lastSeats')
  if (!quantity && !flag || quantity && (!validSeatCount(input.availableSeats) || input.availableSeats != null && typeof input.availableSeats !== 'number') || flag && typeof input.lastSeats !== 'boolean') throw new APIError('Indica cantidad entera y/o etiqueta.', 400)
  if (input.programId == null && (!Array.isArray(input.ids) || !input.ids.length || input.ids.length > 200)) throw new APIError('Selecciona entre 1 y 200 salidas.', 400)
  if (input.programId != null && input.ids?.length) throw new APIError('Selecciona un programa o salidas concretas.', 400)
  const userID = req.user.id
  return inTransaction(req, async () => {
    await lockSeatWrites(req)
    const previousContext = req.context
    try {
      const docs = await req.payload.find({ collection: 'departures', req, overrideAccess: false, depth: 1, pagination: false, sort: 'id', where: input.programId != null ? { programRef: { equals: input.programId } } : { id: { in: input.ids! } }, context: { skipProgramResolution: true } })
      if (!docs.docs.length || input.ids && new Set(input.ids.map(String)).size !== docs.docs.length) throw new APIError('Una salida ya no está disponible. Revisa la selección.', 409)
      const rows = docs.docs.map(doc => {
        const seats = quantity ? input.availableSeats ?? null : doc.availableSeats ?? null
        return { id: doc.id, date: doc.travelDate, origin: typeof doc.origin === 'object' ? doc.origin.name : String(doc.origin), before: doc.availableSeats ?? null, after: seats, lastSeatsBefore: doc.lastSeats === true, lastSeatsAfter: seats !== 0 && (flag ? input.lastSeats === true : doc.lastSeats === true), version: seatVersion(doc) }
      })
      const changes = { ...(quantity ? { availableSeats: input.availableSeats ?? null } : {}), ...(flag ? { lastSeats: input.lastSeats } : {}) }
      const preparedAt = input.action === 'preview' ? Date.now() : input.confirmation?.preparedAt
      const token = seatProof(req, ['assign-seats', userID, preparedAt, changes, rows])
      if (input.action === 'preview') return { rows, token, preparedAt }
      if (!preparedAt || Date.now() - preparedAt > 15 * 60_000 || preparedAt > Date.now() || !equalProof(input.confirmation?.token, token)) throw new APIError('Los cupos o la selección cambiaron. Genera otra vista previa.', 409)
      for (const row of rows) await req.payload.update({ collection: 'departures', id: row.id, req, overrideAccess: false, data: { ...changes, seatsConfirmed: true }, context: { reconcileSeats: quantity, seatReviewOnly: !quantity } })
      return { updated: rows.length, rows }
    } finally { req.context = previousContext }
  })
}
