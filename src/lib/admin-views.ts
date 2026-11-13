import type { Where } from 'payload'
import { DEFAULT_SEATS_VALIDITY_HOURS, seatsValidityHours } from './availability.ts'

export const departureViews = { published: 'Publicadas', expiring: 'Próximas a retirarse', 'seats-review': 'Cupos por revisar', draft: 'Borradores', withdrawn: 'Retiradas' } as const
export type DepartureView = keyof typeof departureViews
export const parseDepartureView = (value: unknown): DepartureView => typeof value === 'string' && value in departureViews ? value as DepartureView : 'published'
export function departureViewWhere(view: DepartureView, now = new Date(), validityHours = DEFAULT_SEATS_VALIDITY_HOURS): Where {
  const current: Where[] = [{ status: { equals: 'published' } }, { withdrawalAt: { greater_than: now.toISOString() } }]
  if (view === 'published') return { and: current }
  if (view === 'expiring') return { and: [...current, { withdrawalAt: { less_than_equal: new Date(now.getTime() + 7 * 86400000).toISOString() } }] }
  if (view === 'seats-review') return { and: [...current,
    { or: [{ availableSeats: { exists: true } }, { lastSeats: { equals: true } }] },
    { or: [{ seatsCheckedAt: { exists: false } }, { seatsCheckedAt: { less_than_equal: new Date(now.getTime() - seatsValidityHours(validityHours) * 3600000).toISOString() } }, { seatsCheckedAt: { greater_than: now.toISOString() } }] },
  ] }
  if (view === 'draft') return { status: { equals: 'draft' } }
  return { or: [{ status: { equals: 'withdrawn' } }, { and: [{ status: { equals: 'published' } }, { withdrawalAt: { less_than_equal: now.toISOString() } }] }] }
}
export function departureViewURL(view: DepartureView) {
  const query = new URLSearchParams({ mtView: view, sort: 'travelDate' })
  return '/admin/collections/departures?' + query.toString()
}
