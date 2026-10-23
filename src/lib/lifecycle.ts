import type { Departure } from './types.ts'

export const TIME_ZONE = 'America/Lima'
export const DEFAULT_ADVANCE_DAYS = 30

export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function retirementAt(travelDate: string, advanceDays = DEFAULT_ADVANCE_DAYS): string {
  if (!isDateOnly(travelDate)) throw new Error('La fecha de salida debe ser válida y tener formato AAAA-MM-DD.')
  if (!Number.isInteger(advanceDays) || advanceDays < 0 || advanceDays > 3650) {
    throw new Error('Los días de anticipación deben ser un entero entre 0 y 3650.')
  }
  // Lima uses UTC−05:00 without DST. Calendar arithmetic first, local midnight second.
  const date = new Date(travelDate + 'T00:00:00.000Z')
  date.setUTCDate(date.getUTCDate() - advanceDays)
  return date.toISOString().slice(0, 10) + 'T05:00:00.000Z'
}

export function isActivePeriod(item: { startsAt?: string | null; endsAt?: string | null }, now = new Date()): boolean {
  return (!item.startsAt || new Date(item.startsAt).getTime() <= now.getTime()) &&
    (!item.endsAt || now.getTime() < new Date(item.endsAt).getTime())
}

export function isPublishable(item: Pick<Departure, 'status' | 'travelDate' | 'advanceDays'>, now = new Date()): boolean {
  try { return item.status === 'published' && now.getTime() < Date.parse(retirementAt(item.travelDate, item.advanceDays)) }
  catch { return false }
}

export function safeExternalUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value))
    return url.protocol === 'https:' && !url.username && !url.password && !!url.hostname
  } catch { return false }
}

export function validatePublication(item: Partial<Departure>, now = new Date()): string[] {
  const errors: string[] = []
  for (const [key, label] of [['program', 'programa'], ['mtpe', 'código MTPE'], ['destination', 'destino'], ['origin', 'origen'], ['priceCondition', 'condición del precio']] as const) {
    if (!String(item[key] || '').trim()) errors.push(`Falta ${label}.`)
  }
  if (!Number.isInteger(item.days) || Number(item.days) < 1) errors.push('La duración debe ser un número entero positivo.')
  if (!Number.isFinite(item.price) || Number(item.price) <= 0) errors.push('El precio debe ser mayor que cero.')
  if (!['USD', 'PEN'].includes(item.currency || '')) errors.push('Indica una moneda válida.')
  if (!item.flyerUrl || (!item.flyerUrl.startsWith('/') && !safeExternalUrl(item.flyerUrl))) errors.push('Falta un flyer válido.')
  if (!safeExternalUrl(item.bookingUrl)) errors.push('El enlace de reserva debe usar HTTPS.')
  if (!safeExternalUrl(item.descriptionUrl)) errors.push('El enlace de descriptivo debe usar HTTPS.')
  try {
    if (now.getTime() >= Date.parse(retirementAt(item.travelDate || '', item.advanceDays ?? 30))) {
      errors.push('La salida ya alcanzó su fecha de retiro. Corrige la salida o el plazo antes de publicarla.')
    }
  } catch (error) { errors.push((error as Error).message) }
  return errors
}

export function validateTransition(previous: Partial<Departure> | undefined, next: Partial<Departure>, options: { now?: Date; reviewConfirmed?: boolean; automatic?: boolean; historicalImport?: boolean } = {}): string[] {
  const errors = next.status === 'published' ? validatePublication(next, options.now) : []
  if (next.status === 'draft' && ['published', 'withdrawn'].includes(previous?.status || '')) {
    errors.push('Una salida publicada o retirada no puede volver a borrador. Retírala indicando un motivo, o reactívala tras revisar sus datos. Puedes duplicarla para crear otro borrador.')
  }
  if (previous?.status === 'withdrawn' && next.status === 'published' && !options.reviewConfirmed) {
    errors.push('Confirma que revisaste precio, enlaces y vigencia para reactivar la salida.')
  }
  if (next.status === 'withdrawn' && previous?.status !== 'withdrawn' && !options.historicalImport) {
    if (!next.withdrawalReason) errors.push('Selecciona un motivo de retiro.')
    if (next.withdrawalReason === 'other' && !next.withdrawalNote?.trim()) errors.push('Explica el motivo «Otro».')
    if (next.withdrawalReason === 'automatic' && !options.automatic) errors.push('El retiro automático está reservado al sistema.')
  }
  return errors
}
