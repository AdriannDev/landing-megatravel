import { createHash } from 'node:crypto'
import { load } from 'cheerio'
import { isDateOnly } from './lifecycle.ts'

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired'
export type MailEvent = {
  mtpe: string; reservation: string; travelDate: string; seats: number; status: ReservationStatus
  kind: 'reservation' | 'modification' | 'confirmation' | 'cancellation' | 'expiration'
  occurredAt: string; version?: number
}
export type ReservationState = MailEvent & { eventKey: string }
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export const pilotMTPE = (value: string) => value.trim().toUpperCase().replace(/^MTPE[\s-]*/, '')
export const eventKey = (event: MailEvent) => digest(JSON.stringify([event.mtpe, event.reservation, event.travelDate, event.seats, event.status, event.kind, event.occurredAt, event.version ?? null]))
export const reservationKey = (event: Pick<MailEvent, 'mtpe' | 'reservation'>) => digest(`${event.mtpe}:${event.reservation}`)

function date(value: string) {
  if (isDateOnly(value)) return value
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const match = plain(value).match(/^(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})$/)
  if (!match) return null
  const month = months.indexOf(match[2].slice(0, 3)) + 1
  const result = `${match[3]}-${String(month).padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return isDateOnly(result) ? result : null
}
// Only explicit, unambiguous business fields are accepted. Never infer seats from passenger lists.
export function extractMailEvent(input: { subject?: string; body: string; html?: boolean }): { event?: MailEvent; reason?: string } {
  if (typeof input.body !== 'string' || input.body.length > 1_000_000) return { reason: 'Cuerpo ausente o demasiado grande.' }
  let text = input.body
  if (input.html) {
    const $ = load(text); $('script,style').remove(); $('br').replaceWith('\n'); $('td,th').append(' '); $('tr,p,div,li').append('\n'); text = $.text()
  }
  const lines = text.replace(/\r/g, '').split('\n').map(line => line.replace(/\u00a0/g, ' ').replace(/^(\s*>\s*)+/, '').trim()).filter(Boolean)
  const field = (labels: string[]) => [...new Set(lines.flatMap(line => {
    const split = line.indexOf(':'); return split >= 0 && labels.includes(plain(line.slice(0, split))) ? [line.slice(split + 1).trim()] : []
  }))]
  const one = (labels: string[]) => { const values = field(labels); return values.length === 1 ? values[0] : '' }
  const code = one(['mtpe', 'codigo mtpe', 'programa']), reservation = one(['reserva', 'identificador de reserva', 'numero de reserva', 'id de reserva']).toUpperCase()
  const travelDate = date(one(['salida', 'fecha de salida']))
  const seatsText = one(['sillas', 'cupos', 'cantidad de sillas']), seats = /^\d{1,5}$/.test(seatsText) ? Number(seatsText) : NaN
  const statusText = plain(one(['estado', 'estado de reserva']))
  const statuses: Record<string, ReservationStatus> = { 'a peticion': 'pending', 'confirmada': 'confirmed', 'confirmado': 'confirmed', 'cancelada': 'cancelled', 'cancelado': 'cancelled', 'vencida': 'expired', 'vencido': 'expired' }
  const status = statuses[statusText]
  const kindText = plain(one(['tipo', 'evento', 'tipo de evento']))
  const kinds: Record<string, MailEvent['kind']> = { reserva: 'reservation', modificacion: 'modification', confirmacion: 'confirmation', cancelacion: 'cancellation', vencimiento: 'expiration' }
  const kind = kinds[kindText] || (!kindText && status ? ({ pending: 'reservation', confirmed: 'confirmation', cancelled: 'cancellation', expired: 'expiration' } as const)[status] : undefined)
  const occurred = one(['fecha del evento', 'fecha de evento']), versionText = one(['version', 'version del evento'])
  // Delivery/forwarding timestamps cannot establish the order of a business event.
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(occurred) || !isDateOnly(occurred.slice(0, 10)) || !Number.isFinite(Date.parse(occurred))) return { reason: 'Falta una fecha del evento con zona horaria y orden fiable.' }
  if (!/^(?:MTPE[\s-]*)?[A-Z0-9][A-Z0-9-]{1,39}$/i.test(code) || !/^[A-Z0-9][A-Z0-9/-]{1,79}$/.test(reservation) || !travelDate || !status || !kind) return { reason: 'Programa, reserva, fecha, estado o tipo ausente o ambiguo.' }
  if (versionText && (!/^\d{1,9}$/.test(versionText))) return { reason: 'Versión del evento no válida.' }
  if (status === 'pending' || status === 'confirmed') {
    if (!Number.isSafeInteger(seats) || seats < 1) return { reason: 'Falta la cantidad explícita de sillas. No se cuentan pasajeros automáticamente.' }
  }
  if ((kind === 'cancellation') !== (status === 'cancelled') || (kind === 'expiration') !== (status === 'expired') || kind === 'confirmation' && status !== 'confirmed') return { reason: 'El tipo y el estado del evento se contradicen.' }
  return { event: { mtpe: pilotMTPE(code), reservation, travelDate, seats: status === 'cancelled' || status === 'expired' ? 0 : seats, status, kind, occurredAt: new Date(occurred).toISOString(), ...(versionText ? { version: Number(versionText) } : {}) } }
}

export function proposeMovement(pool: { initialSeats?: number; remainingSeats: number; cutoffAt: string }, previous: ReservationState | undefined, event: MailEvent): { reason?: string; delta?: number; remainingSeats?: number } {
  if (Date.parse(event.occurredAt) <= Date.parse(pool.cutoffAt)) return { reason: 'Evento anterior o igual a la fecha de corte del saldo inicial.' }
  if (previous) {
    if ((event.version == null) !== (previous.version == null)) return { reason: 'No se pueden comparar eventos con y sin versión.' }
    if (event.version != null ? event.version <= previous.version! : Date.parse(event.occurredAt) <= Date.parse(previous.occurredAt)) return { reason: 'Evento antiguo o con orden ambiguo.' }
    if (Date.parse(event.occurredAt) < Date.parse(previous.occurredAt)) return { reason: 'La versión contradice la fecha del evento.' }
    if (['cancelled', 'expired'].includes(previous.status) && !['cancelled', 'expired'].includes(event.status)) return { reason: 'La reserva finalizada requiere revisión antes de reabrirse.' }
    if (event.kind === 'confirmation' && previous.seats !== event.seats) return { reason: 'Una confirmación cambia las sillas sin una modificación explícita.' }
  } else if (event.kind !== 'reservation') return { reason: 'Reserva desconocida. Revisa el estado anterior antes de proponer cupos.' }
  const delta = (previous?.seats || 0) - event.seats
  const remainingSeats = pool.remainingSeats + delta
  if (!Number.isSafeInteger(remainingSeats) || remainingSeats < 0 || (pool.initialSeats != null && remainingSeats > pool.initialSeats)) return { reason: 'El movimiento produciría un saldo incoherente.' }
  return { delta, remainingSeats }
}
