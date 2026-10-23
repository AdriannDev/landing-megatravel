import type { Departure, Promotion } from '../lib/types'
// Payload documents are normalized at the server boundary; relationship population is optional.
type Document = Record<string, any>
export function mediaUrl(value: unknown): string {
  return typeof value === 'object' && value !== null && 'url' in value ? String(value.url || '') : ''
}
export function relationName(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object' && 'name' in value) return String(value.name || '')
  return String(value)
}
export function cmsToDeparture(doc: Document): Departure {
  return {
    id: String(doc.stableId || doc.id || ''), program: doc.program || '', mtpe: doc.mtpe || '',
    destination: relationName(doc.destination), zone: doc.zone || '', origin: relationName(doc.origin), cruiseLine: relationName(doc.cruiseLine) || null,
    days: doc.days, nights: doc.nights, travelDate: String(doc.travelDate || '').slice(0, 10),
    price: doc.price, currency: doc.currency, priceCondition: doc.priceCondition || '',
    flyerUrl: mediaUrl(doc.flyer) || doc.flyerSourceUrl || (doc.flyer ? '/api/media' : ''),
    bookingUrl: doc.bookingUrl || '', descriptionUrl: doc.descriptionUrl || '', priority: doc.priority || 0,
    promotions: (doc.promotions || []).filter((p: unknown) => p && typeof p === 'object').map((p: Document): Promotion => ({ id: String(p.slug || p.id), name: p.name, label: p.label, startsAt: p.startsAt, endsAt: p.endsAt })),
    status: doc.status || 'draft', advanceDays: doc.advanceDays ?? 30, withdrawalAt: doc.withdrawalAt || '',
    withdrawalReason: doc.withdrawalReason, withdrawalNote: doc.withdrawalNote,
    retiredAt: doc.retiredAt || null, sourceKey: doc.sourceKey || '', sourceSheet: doc.sourceSheet || '', sourceRef: doc.sourceRef || '',
    sourceRetirementDate: doc.sourceRetirementDate || null, sourceRetirementRaw: doc.sourceRetirementRaw || null,
  }
}
