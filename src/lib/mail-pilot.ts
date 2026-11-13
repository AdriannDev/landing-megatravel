import { createHash } from 'node:crypto'
import { load } from 'cheerio'
import { isDateOnly } from './lifecycle.ts'

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired'
export type MailOrder = { scope: string; sequence: number }
export type MailEvent = {
  mtpe: string; seats: number; status: ReservationStatus
  reservation?: string; travelDate?: string; origin?: string
  departureStableId?: string; originId?: string; programId?: string; programCreatedAt?: string
  kind?: 'reservation' | 'modification' | 'confirmation' | 'cancellation' | 'expiration'
  occurredAt?: string; version?: number
  receivedAt?: string; order?: MailOrder
}
export type ReservationState = MailEvent & { eventKey?: string; occupiedSeats?: number; lastActiveSeats?: number }
export type MailExtraction = { event?: MailEvent; fields: Partial<MailEvent>; reason?: string }
export const digest = (value: string) => createHash('sha256').update(value).digest('hex')
const fold = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const plain = (value: string) => fold(value).toLowerCase().trim()
export const pilotMTPE = (value: string) => value.trim().toUpperCase().replace(/^MTPE[\s-]*/, '')
// Transport fingerprints are separate. A later return to the same quantity is
// legitimate when there is no business version or date to identify a duplicate.
export const eventKey = (event: MailEvent) => digest(JSON.stringify([event.mtpe, event.reservation ?? null, event.travelDate ?? null, event.origin ?? null, event.seats, event.status, event.kind ?? null, event.occurredAt ?? null, event.version ?? null]))
export const reservationKey = (event: Pick<MailEvent, 'mtpe' | 'reservation'>) => digest(`${event.mtpe}:${event.reservation}`)
export const isActiveReservation = (status: ReservationStatus) => status === 'pending' || status === 'confirmed'

export function normalizeReservation(value: string) {
  const code = value.trim().toUpperCase()
  const numeric = code.match(/^(?:M\s*T\s*P\s*[-\u2013\u2014]?\s*)?(\d{1,80})$/)
  if (numeric) return `MTP-${numeric[1]}`
  return /^[A-Z0-9][A-Z0-9/-]{0,79}$/.test(code) && !/^MTPE(?:-|$)/.test(code) ? code : undefined
}
export function resolveMailDeparture<T extends { stableId?: string | null; travelDate: string; origin: unknown }>(departures: T[], event: Pick<MailEvent, 'travelDate' | 'origin'>): { departure?: T; reason?: string } {
  const dates = [...new Set(departures.map(d => d.travelDate))]
  const travelDate = event.travelDate || (dates.length === 1 ? dates[0] : undefined)
  if (!travelDate) return { reason: 'Falta la fecha de salida; el programa tiene varias fechas registradas.' }
  let matches = departures.filter(d => d.travelDate === travelDate)
  if (event.origin) matches = matches.filter(d => plain(typeof d.origin === 'object' && d.origin && 'name' in d.origin ? String(d.origin.name) : String(d.origin)) === plain(event.origin!))
  if (matches.length !== 1) return { reason: matches.length ? 'El origen es ambiguo para esta fecha. Identifica un único origen.' : 'No existe una salida del programa para esta fecha y origen.' }
  return { departure: matches[0] }
}

function date(value: string) {
  if (isDateOnly(value.slice(0))) return value
  const numeric = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const match = plain(value).match(/^(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})$/)
  if (!numeric && !match) return undefined
  const day = (numeric || match)![1], year = (numeric || match)![3]
  const month = numeric ? Number(numeric[2]) : months.indexOf(match![2].slice(0, 3)) + 1
  const result = `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`
  return isDateOnly(result) ? result : undefined
}
export function mailTimestamp(value?: string) {
  return value && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value) && isDateOnly(value.slice(0, 10)) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : undefined
}
const labels = {
  mtpe: ['codigo mtpe', 'mtpe', 'programa'],
  reservation: ['codigo de la reserva', 'numero de la reserva', 'referencia de la reserva', 'codigo de reserva', 'codigo reserva', 'numero de reserva', 'numero reserva', 'referencia de reserva', 'referencia reserva', 'identificador de reserva', 'id de reserva', 'localizador de reserva', 'localizador', 'reserva', 'codigo', 'numero', 'referencia'],
  travelDate: ['fecha de salida', 'salida'],
  origin: ['ciudad de origen', 'origen de salida', 'origen'],
  seats: ['cantidad de sillas', 'cantidad de cupos', 'cantidad de plazas', 'cantidad', 'sillas', 'cupos', 'plazas'],
  status: ['estado de reserva', 'estado'],
  kind: ['tipo de evento', 'evento', 'tipo'],
  occurredAt: ['fecha del evento', 'fecha de evento', 'fecha comercial'],
  version: ['version del evento', 'version'],
} as const
const fieldNames: Record<keyof typeof labels, string> = { mtpe: 'MTPE', reservation: 'localizador', travelDate: 'fecha de salida', origin: 'origen', seats: 'cantidad de sillas', status: 'estado', kind: 'tipo de evento', occurredAt: 'fecha comercial', version: 'versión' }
const statuses: Record<string, ReservationStatus> = { 'a peticion': 'pending', 'reserva': 'confirmed', 'pendiente de confirmar': 'pending', 'confirmada': 'confirmed', 'confirmado': 'confirmed', 'cancelada': 'cancelled', 'cancelado': 'cancelled', 'anulada': 'cancelled', 'anulado': 'cancelled', 'vencida': 'expired', 'vencido': 'expired' }
const kinds: Record<string, MailEvent['kind']> = { reserva: 'reservation', modificacion: 'modification', confirmacion: 'confirmation', cancelacion: 'cancellation', anulacion: 'cancellation', vencimiento: 'expiration' }

function eventConflict(fields: Partial<MailEvent>) {
  if (fields.status && isActiveReservation(fields.status) && fields.seats === 0) return 'La cantidad activa de sillas debe ser mayor que cero.'
  if (fields.kind && fields.status && ((fields.kind === 'cancellation') !== (fields.status === 'cancelled') || (fields.kind === 'expiration') !== (fields.status === 'expired') || fields.kind === 'confirmation' && fields.status !== 'confirmed')) return 'El tipo y el estado del evento se contradicen.'
}

// Only explicitly labelled quantities are accepted. Passenger lists are never counted.
export function extractMailEvent(input: { subject?: string; body: string; html?: boolean }): MailExtraction {
  const fields: Partial<MailEvent> = {}, reasons: string[] = []
  if (typeof input.body !== 'string' || input.body.length > 1_000_000) return { fields, reason: 'Cuerpo ausente o demasiado grande.' }
  let text = input.body
  if (input.html) {
    const $ = load(text)
    $('script,style').remove()
    $('tr').each((_, row) => {
      const cells = $(row).children('td,th')
      if (cells.length === 2) $(row).replaceWith('\n' + cells.first().text().trim().replace(/[:=]\s*$/, '') + ': ' + cells.last().text().trim() + '\n')
    })
    $('br').replaceWith('\n'); $('td,th').append(' '); $('tr,p,div,li').append('\n'); text = $.text()
  }
  const allLabels = Object.values(labels).flat().sort((a, b) => b.length - a.length).join('|')
  text = fold(`${input.subject?.replace(/^(?:(?:fwd?|re|rv)\s*:\s*)+/i, '') || ''}\n${text}`)
    .replace(/\r|\u00a0/g, ' ').replace(/^(\s*>\s*)+/gm, '')
    .replace(new RegExp(`\\b(${allLabels})[ \\t]*[:=#][ \\t]*`, 'gi'), '\n$1: ')
  const values = new Map<string, string[]>()
  for (const line of text.split('\n')) {
    const match = line.trim().match(new RegExp(`^(${allLabels})\\s*:\\s*(.*?)\\s*(?:[|;,]|\\s+[-–—])?$`, 'i'))
    if (match?.[2]) values.set(plain(match[1]), [...(values.get(plain(match[1])) || []), match[2].trim()])
  }
  for (const match of text.matchAll(/\bMTPE[ -]+([0-9][A-Z0-9-]{0,39})\b/gi)) values.set('mtpe', [...(values.get('mtpe') || []), match[1]])
  // MTP is a reservation; MTPE is a program. Bare digits are never scanned.
  for (const match of text.matchAll(/\bM\s*T\s*P[\s\-\u2013\u2014]+(\d{1,80})\b/gi)) values.set('reserva', [...(values.get('reserva') || []), `MTP-${match[1]}`])
  // "Programa" often contains the commercial name alongside an explicit MTPE.
  if (values.has('mtpe') || values.has('codigo mtpe')) values.delete('programa')
  function read<K extends keyof typeof labels>(key: K, convert: (value: string) => MailEvent[K] | undefined, required = false) {
    const raw = labels[key].flatMap(label => values.get(label) || [])
    const converted = raw.map(convert)
    const distinct = [...new Set(converted.filter(value => value !== undefined))]
    if (distinct.length === 1) Object.assign(fields, { [key]: distinct[0] })
    if (distinct.length > 1 || converted.some(value => value === undefined)) reasons.push(`El campo ${fieldNames[key]} es inválido o contradictorio.`)
    else if (required && !distinct.length) reasons.push(`Falta ${key === 'seats' ? 'la cantidad explícita de sillas; no se cuentan pasajeros' : key === 'mtpe' ? 'el MTPE' : 'el estado'}.`)
  }
  read('mtpe', value => /^(?:MTPE[\s-]*)?[A-Z0-9][A-Z0-9-]{1,39}$/i.test(value) ? pilotMTPE(value) : undefined, true)
  read('reservation', normalizeReservation)
  read('travelDate', date)
  read('origin', value => value.trim() ? value.trim().replace(/\s+/g, ' ').toUpperCase() : undefined)
  read('seats', value => /^\d{1,5}$/.test(value) ? Number(value) : undefined, true)
  read('status', value => statuses[plain(value)], true)
  read('kind', value => kinds[plain(value)])
  read('occurredAt', mailTimestamp)
  read('version', value => /^\d{1,9}$/.test(value) ? Number(value) : undefined)
  const conflict = eventConflict(fields)
  if (conflict) reasons.push(conflict)
  return reasons.length ? { fields, reason: reasons.join(' ') } : { fields, event: fields as MailEvent }
}

export function compareMailParts(a: MailExtraction, b: MailExtraction): MailExtraction {
  const fields = { ...b.fields, ...a.fields }
  const conflicts = (Object.keys(fields) as (keyof MailEvent)[]).filter(key => a.fields[key] !== undefined && b.fields[key] !== undefined && a.fields[key] !== b.fields[key])
  const invalid = [a.reason, b.reason].filter(reason => reason && !reason.split('. ').every(part => part.startsWith('Falta ')))
  if (conflicts.length || invalid.length) return { fields, reason: conflicts.length ? `Las partes de texto y HTML no identifican datos coincidentes: ${conflicts.map(key => (fieldNames as Record<string, string>)[key] || key).join(', ')}.` : invalid.join(' ') }
  if (!fields.mtpe || fields.seats == null || !fields.status) return { fields, reason: 'Las partes de texto y HTML no identifican los datos principales completos.' }
  const conflict = eventConflict(fields)
  if (conflict) return { fields, reason: conflict }
  return { fields, event: fields as MailEvent }
}

export function proposeMovement(pool: { initialSeats?: number; remainingSeats: number; cutoffAt: string }, previous: ReservationState | undefined, event: MailEvent): { reason?: string; delta?: number; remainingSeats?: number } {
  if ([event.occurredAt, event.receivedAt].some(timestamp => timestamp && Date.parse(timestamp) <= Date.parse(pool.cutoffAt))) return { reason: 'Evento anterior o igual a la fecha de corte del saldo inicial.' }
  if (previous) {
    if (event.version != null && previous.version != null && event.version <= previous.version) return { reason: 'Evento antiguo o con orden ambiguo.' }
    if (event.occurredAt && previous.occurredAt && (Date.parse(event.occurredAt) < Date.parse(previous.occurredAt) || event.version == null && previous.version == null && event.occurredAt === previous.occurredAt)) return { reason: 'Evento antiguo o la versión contradice la fecha del evento.' }
    if (event.order && previous.order && event.order.scope === previous.order.scope && event.order.sequence <= previous.order.sequence) return { reason: 'Evento antiguo según el orden persistente del buzón.' }
    if (event.receivedAt && previous.receivedAt && Date.parse(event.receivedAt) < Date.parse(previous.receivedAt)) return { reason: 'Evento antiguo según la fecha persistente del mensaje.' }
  } else if (!isActiveReservation(event.status)) return { reason: 'Cancelación o anulación de una reserva desconocida.' }
  const occupied = previous ? previous.occupiedSeats ?? (isActiveReservation(previous.status) ? previous.seats : 0) : 0
  if (!isActiveReservation(event.status) && event.seats !== 0 && event.seats !== (occupied || previous?.lastActiveSeats || previous?.seats)) return { reason: 'La cantidad de la cancelación no coincide con los cupos conocidos de la reserva.' }
  const delta = occupied - (isActiveReservation(event.status) ? event.seats : 0)
  const remainingSeats = pool.remainingSeats + delta
  if (!Number.isSafeInteger(remainingSeats) || remainingSeats < 0) return { reason: 'El movimiento produciría un saldo incoherente o insuficiente.' }
  return { delta, remainingSeats }
}
