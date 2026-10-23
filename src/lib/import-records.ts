import { parseSourceDate, parsePrice } from './csv.ts'
import { retirementAt, safeExternalUrl, validateTransition } from './lifecycle.ts'
import type { Departure, Status, WithdrawalReason } from './types.ts'

export function rowToDeparture(row: Record<string, string>, options: { now?: Date; historical?: boolean } = {}): Departure {
  const sourceKey = row.source_key || (row.source_sheet && row.source_ref ? `csv:${encodeURIComponent(row.source_sheet)}:${encodeURIComponent(row.source_ref)}` : '')
  if (!sourceKey) throw new Error('Indica source_key o source_sheet y source_ref para evitar duplicados.')
  if (!row.program?.trim()) throw new Error('Falta el nombre del programa.')
  if (!row.mtpe?.trim()) throw new Error('Falta el código MTPE.')
  const status = (row.status || 'draft') as Status
  if (!['draft', 'published', 'withdrawn'].includes(status)) throw new Error('Estado no reconocido.')
  const travelDate = parseSourceDate(row.travel_date || '')
  const advanceDays = row.advance_days === '' || row.advance_days == null ? 30 : Number(row.advance_days)
  const currency = row.currency || 'USD'
  if (!['USD', 'PEN'].includes(currency)) throw new Error('Moneda no reconocida.')
  if (!Number.isInteger(Number(row.days)) || Number(row.days) <= 0) throw new Error('Duración no válida.')
  if (row.flyer_url && !safeExternalUrl(row.flyer_url) && !row.flyer_url.startsWith('/flyers/')) throw new Error('Enlace del flyer no válido.')
  const reason = row.withdrawal_reason || null
  if (reason && !['request', 'sold-out', 'price-change', 'other', 'automatic'].includes(reason)) throw new Error('Motivo de retiro no reconocido.')
  const item: Departure = {
    id: sourceKey, sourceKey, sourceSheet: row.source_sheet || '', sourceRef: row.source_ref || '',
    program: row.program, mtpe: row.mtpe, destination: row.destination || '', zone: row.zone || '', origin: row.origin || '', cruiseLine: row.cruise_line || null,
    days: Number(row.days), nights: row.nights ? Number(row.nights) : null, travelDate,
    price: parsePrice(row.price || ''), currency: currency as 'USD' | 'PEN', priceCondition: row.price_condition || 'Por persona en habitación doble',
    flyerUrl: row.flyer_url || '', bookingUrl: row.booking_url || '', descriptionUrl: row.description_url || '',
    promotions: (row.promotions || '').split('|').filter(Boolean).map(name => ({ id: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, label: name })),
    priority: Number(row.priority || 0), advanceDays, withdrawalAt: retirementAt(travelDate, advanceDays), status,
    withdrawalReason: reason as WithdrawalReason | null, withdrawalNote: row.withdrawal_note || null,
    retiredAt: row.retired_at || null, sourceRetirementDate: row.source_retirement_date || null, sourceRetirementRaw: row.source_retirement_raw || null,
  }
  if (!Number.isFinite(item.priority)) throw new Error('Prioridad no válida.')
  if (item.nights != null && (!Number.isInteger(item.nights) || item.nights < 0)) throw new Error('Noches no válidas.')
  if (item.retiredAt && !Number.isFinite(Date.parse(item.retiredAt))) throw new Error('Fecha de retiro histórico no válida.')
  const errors = validateTransition(undefined, item, { now: options.now, historicalImport: options.historical, automatic: options.historical && item.withdrawalReason === 'automatic' })
  if (errors.length) throw new Error(errors.join(' '))
  return item
}

export function planImport(rows: Record<string, string>[], options: { now?: Date; historical?: boolean } = {}) {
  const seen = new Set<string>()
  const accepted: { row: number; item: Departure }[] = [], errors: { row: number; error: string }[] = []
  for (let index = 0; index < rows.length; index++) {
    try {
      const item = rowToDeparture(rows[index], options)
      if (seen.has(item.sourceKey!)) throw new Error('Clave de importación repetida dentro del archivo.')
      seen.add(item.sourceKey!)
      accepted.push({ row: index + 2, item })
    } catch (error) { errors.push({ row: index + 2, error: (error as Error).message }) }
  }
  return { accepted, errors }
}
