import { createHash } from 'node:crypto'
import { load } from 'cheerio'
import { isDateOnly } from './lifecycle.ts'

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired'
export type MailOrder = { scope: string; sequence: number }
export type MailEvent = {
  mtpe: string; seats: number; status: ReservationStatus
  reservation?: string; tripId?: string; travelDate?: string; origin?: string
  departureStableId?: string; originId?: string; programId?: string; programCreatedAt?: string
  kind?: 'reservation' | 'modification' | 'confirmation' | 'cancellation' | 'expiration'
  occurredAt?: string; version?: number
  receivedAt?: string; order?: MailOrder
}
export type ReservationState = MailEvent & { eventKey?: string; occupiedSeats?: number; lastActiveSeats?: number }
export type MailIssue = { code: 'missing' | 'invalid' | 'conflict' | 'body'; field?: keyof MailEvent; message: string }
export type MailExtraction = { event?: MailEvent; fields: Partial<MailEvent>; issues: MailIssue[]; reason?: string; templateCheckDates?: (string | null)[] }
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
  tripId: ['id del viaje'],
  travelDate: ['fecha de salida', 'salida'],
  origin: ['ciudad de origen', 'origen de salida', 'origen'],
  seats: ['cantidad de sillas', 'cantidad de cupos', 'cantidad de plazas', 'cantidad', 'sillas', 'cupos', 'plazas', 'reservas', 'pasajeros'],
  status: ['estado de la reserva', 'estado de reserva', 'estado'],
  kind: ['tipo de evento', 'evento', 'tipo'],
  occurredAt: ['fecha del evento', 'fecha de evento', 'fecha comercial'],
  version: ['version del evento', 'version'],
} as const
const fieldNames: Record<keyof typeof labels, string> = { mtpe: 'MTPE', reservation: 'localizador', tripId: 'ID del viaje', travelDate: 'fecha de salida', origin: 'origen', seats: 'cantidad de sillas', status: 'estado', kind: 'tipo de evento', occurredAt: 'fecha comercial', version: 'versión' }
const statuses: Record<string, ReservationStatus> = { rq: 'pending', 'a peticion': 'pending', 'reserva': 'confirmed', 'pendiente de confirmar': 'pending', 'confirmada': 'confirmed', 'confirmado': 'confirmed', 'cancelada': 'cancelled', 'cancelado': 'cancelled', 'anulada': 'cancelled', 'anulado': 'cancelled', 'vencida': 'expired', 'vencido': 'expired' }
const kinds: Record<string, MailEvent['kind']> = { reserva: 'reservation', modificacion: 'modification', confirmacion: 'confirmation', cancelacion: 'cancellation', anulacion: 'cancellation', vencimiento: 'expiration' }

function eventConflict(fields: Partial<MailEvent>) {
  if (fields.status && isActiveReservation(fields.status) && fields.seats === 0) return 'La cantidad activa de sillas debe ser mayor que cero.'
  if (fields.kind && fields.status && ((fields.kind === 'cancellation') !== (fields.status === 'cancelled') || (fields.kind === 'expiration') !== (fields.status === 'expired') || fields.kind === 'confirmation' && fields.status !== 'confirmed')) return 'El tipo y el estado del evento se contradicen.'
}

function finishExtraction(fields: Partial<MailEvent>, problems: MailIssue[], templateCheckDates: (string | null)[] = []): MailExtraction {
  const issues = problems.filter(issue => issue.code !== 'missing')
  // Text and HTML can supply different portions of the same template. Resolve
  // this candidate only once the combined reservation identifies Meganet.
  if (fields.reservation && /^MTP-CLOSEDTOUR-\d+$/.test(fields.reservation) && !issues.some(issue => issue.field === 'reservation') && templateCheckDates.length) {
    const dates = [...new Set([...templateCheckDates.filter((value): value is string => value !== null), ...(fields.travelDate ? [fields.travelDate] : [])])]
    if (templateCheckDates.includes(null) || dates.length > 1) issues.push({ code: dates.length > 1 ? 'conflict' : 'invalid', field: 'travelDate', message: 'La fecha de salida de Comprobación es inválida o contradictoria.' })
    else if (dates.length === 1) fields.travelDate = dates[0]
  }
  for (const [field, message] of [
    ['mtpe', 'Falta el MTPE.'],
    ['seats', 'Falta la cantidad explícita de sillas; no se cuentan listas de pasajeros.'],
    ['status', 'Falta el estado.'],
  ] as const) {
    if (fields[field] == null && !issues.some(issue => issue.field === field)) issues.push({ code: 'missing', field, message })
  }
  const conflict = eventConflict(fields)
  if (conflict && !issues.some(issue => issue.message === conflict)) issues.push({ code: 'conflict', message: conflict })
  const result = { fields, issues, ...(templateCheckDates.length ? { templateCheckDates } : {}) }
  return issues.length ? { ...result, reason: [...new Set(issues.map(issue => issue.message))].join(' ') } : { ...result, event: fields as MailEvent }
}

// Only explicitly labelled quantities are accepted. Passenger lists are never counted.
export function extractMailEvent(input: { subject?: string; body: string; html?: boolean }): MailExtraction {
  const fields: Partial<MailEvent> = {}, issues: MailIssue[] = []
  if (typeof input.body !== 'string' || input.body.length > 1_000_000) return { fields, issues: [{ code: 'body', message: 'Cuerpo ausente o demasiado grande.' }], reason: 'Cuerpo ausente o demasiado grande.' }
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
  const allLabels = [...Object.values(labels).flat(), 'comprobacion'].sort((a, b) => b.length - a.length).join('|')
  text = fold(`${input.subject?.replace(/^(?:(?:fwd?|re|rv)\s*:\s*)+/i, '') || ''}\n${text}`)
    .replace(/\r|\u00a0/g, ' ').replace(/^(\s*>\s*)+/gm, '')
    .replace(new RegExp(`\\b(${allLabels})[ \\t]*[:=#][ \\t]*`, 'gi'), '\n$1: ')
  const values = new Map<string, string[]>()
  for (const line of text.split('\n')) {
    const match = line.trim().match(new RegExp(`^(${allLabels})\\s*:\\s*(.*?)\\s*(?:[|;,]|\\s+[-–—])?$`, 'i'))
    if (match?.[2]) values.set(plain(match[1]), [...(values.get(plain(match[1])) || []), match[2].trim()])
  }
  for (const match of text.matchAll(/\bMTPE[ -]+([0-9][A-Z0-9-]{0,39})\b/gi)) values.set('mtpe', [...(values.get('mtpe') || []), match[1]])
  // Exclude only labelled trip-ID lines. The same code elsewhere still conflicts.
  // Scan the complete CLOSEDTOUR reference too; MTPE and bare digits are not reservations.
  const reservationText = text.split('\n').filter(line => !/^\s*id del viaje\s*:/i.test(line)).join('\n')
  for (const match of reservationText.matchAll(/\bM\s*T\s*P[\s\-\u2013\u2014]+((?:CLOSEDTOUR-)?\d{1,80})\b/gi)) values.set('reserva', [...(values.get('reserva') || []), `MTP-${match[1].toUpperCase()}`])
  // "Programa" often contains the commercial name alongside an explicit MTPE.
  if (values.has('mtpe') || values.has('codigo mtpe')) values.delete('programa')
  function read<K extends keyof typeof labels>(key: K, convert: (value: string) => MailEvent[K] | undefined) {
    const raw = labels[key].flatMap(label => values.get(label) || [])
    const converted = raw.map(convert)
    const distinct = [...new Set(converted.filter(value => value !== undefined))]
    if (distinct.length === 1) Object.assign(fields, { [key]: distinct[0] })
    if (distinct.length > 1 || converted.some(value => value === undefined)) issues.push({ code: distinct.length > 1 ? 'conflict' : 'invalid', field: key, message: `El campo ${fieldNames[key]} es inválido o contradictorio.` })
  }
  read('mtpe', value => /^(?:MTPE[\s-]*)?[A-Z0-9][A-Z0-9-]{1,39}$/i.test(value) ? pilotMTPE(value) : undefined)
  read('reservation', normalizeReservation)
  read('tripId', normalizeReservation)
  read('travelDate', date)
  read('origin', value => value.trim() ? value.trim().replace(/\s+/g, ' ').toUpperCase() : undefined)
  read('seats', value => /^(\d{1,5})(?:\s+personas?)?$/i.test(value) ? Number(value.match(/^\d+/)![0]) : undefined)
  read('status', value => statuses[plain(value)])
  read('kind', value => kinds[plain(value)])
  read('occurredAt', mailTimestamp)
  read('version', value => /^\d{1,9}$/.test(value) ? Number(value) : undefined)
  return finishExtraction(fields, issues, (values.get('comprobacion') || []).map(value => date(value) ?? null))
}

export function compareMailParts(a: MailExtraction, b: MailExtraction): MailExtraction {
  const fields = { ...b.fields, ...a.fields }
  const conflicts = (Object.keys(fields) as (keyof MailEvent)[]).filter(key => a.fields[key] !== undefined && b.fields[key] !== undefined && a.fields[key] !== b.fields[key])
  const issues = [...a.issues, ...b.issues].filter(issue => issue.code !== 'missing')
  for (const key of conflicts) issues.push({ code: 'conflict', field: key, message: `Las partes de texto y HTML no identifican datos coincidentes: ${(fieldNames as Record<string, string>)[key] || key}.` })
  return finishExtraction(fields, issues, [...(a.templateCheckDates || []), ...(b.templateCheckDates || [])])
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
