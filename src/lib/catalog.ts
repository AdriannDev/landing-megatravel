import type { CatalogFilters, Departure, PublicPackage } from './types.ts'
import { isActivePeriod, isDateOnly, isPublishable } from './lifecycle.ts'
import { DEFAULT_FLYER } from './flyer.ts'
import { publicAvailability, DEFAULT_SEATS_VALIDITY_HOURS } from './availability.ts'

export const PAGE_SIZE = 12
export const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
export const emptyFilters = (): CatalogFilters => ({ q: '', zones: [], destinations: [], origins: [], months: [], programs: [], promotions: [], cruiseLines: [], from: '', to: '', sort: 'featured', page: 1 })
const multiple = ['zones', 'destinations', 'origins', 'months', 'programs', 'promotions', 'cruiseLines'] as const

export function parseFilters(params: URLSearchParams): CatalogFilters {
  const filters = emptyFilters()
  filters.q = (params.get('q') || '').trim().slice(0, 200)
  for (const key of multiple) filters[key] = [...new Set(params.getAll(key).filter(Boolean))].slice(0, 100)
  filters.months = filters.months.filter(v => /^\d{4}-(0[1-9]|1[0-2])$/.test(v))
  for (const key of ['from', 'to'] as const) filters[key] = isDateOnly(params.get(key)) ? params.get(key)! : ''
  const sort = params.get('sort')
  if (['featured', 'date', 'price-asc', 'price-desc', 'duration'].includes(sort || '')) filters.sort = sort as CatalogFilters['sort']
  const page = Number(params.get('page'))
  filters.page = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 100000) : 1
  return filters
}

export function serializeFilters(filters: CatalogFilters): string {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  for (const key of multiple) for (const value of filters[key]) params.append(key, value)
  for (const key of ['from', 'to'] as const) if (filters[key]) params.set(key, filters[key])
  if (filters.sort !== 'featured') params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))
  return params.toString()
}

export function toPublicPackage(item: Departure, now = new Date(), validityHours = DEFAULT_SEATS_VALIDITY_HOURS): PublicPackage {
  // Explicit allowlist: never spread CMS documents into public data.
  return {
    id: item.id, program: item.program, mtpe: item.mtpe, destination: item.destination, zone: item.zone,
    origin: item.origin, cruiseLine: item.cruiseLine || null, days: item.days, nights: item.nights ?? null,
    travelDate: item.travelDate, price: item.price, currency: item.currency, priceCondition: item.priceCondition,
    flyerUrl: item.flyerUrl || DEFAULT_FLYER, bookingUrl: item.bookingUrl, descriptionUrl: item.descriptionUrl,
    priority: item.priority,
    availability: publicAvailability(item, validityHours, now.getTime()),
    promotions: (item.promotions || []).filter(p => isActivePeriod(p, now)).map(p => ({ id: p.id, name: p.name, label: p.label })),
  }
}

export const publishedPackages = (items: Departure[], now = new Date(), validityHours = DEFAULT_SEATS_VALIDITY_HOURS) => items.filter(p => isPublishable(p, now)).map(p => toPublicPackage(p, now, validityHours))

export function filterCatalog(items: PublicPackage[], filters: CatalogFilters) {
  const matches = (selected: string[], value: string) => !selected.length || selected.some(s => normalize(s) === normalize(value))
  const words = normalize(filters.q).split(/\s+/).filter(Boolean)
  const filtered = items.filter(p => {
    const haystack = normalize([p.program, p.mtpe, `MTPE-${p.mtpe}`, p.destination, p.zone, p.origin].join(' '))
    return words.every(w => haystack.includes(w)) && matches(filters.zones, p.zone) &&
      matches(filters.destinations, p.destination) && matches(filters.origins, p.origin) &&
      matches(filters.months, p.travelDate.slice(0, 7)) && matches(filters.programs, p.program) &&
      matches(filters.cruiseLines, p.cruiseLine || '') &&
      (!filters.promotions.length || p.promotions.some(promo => filters.promotions.includes(promo.id))) &&
      (!filters.from || p.travelDate >= filters.from) && (!filters.to || p.travelDate <= filters.to)
  })
  filtered.sort((a, b) => {
    let result = 0
    if (filters.sort === 'featured') result = b.priority - a.priority
    if (filters.sort === 'price-asc' || filters.sort === 'price-desc') {
      // Do not compare unlike currencies as if they had the same value.
      result = a.currency.localeCompare(b.currency) || (a.price - b.price) * (filters.sort === 'price-desc' ? -1 : 1)
    }
    if (filters.sort === 'duration') result = a.days - b.days
    return result || a.travelDate.localeCompare(b.travelDate) || a.id.localeCompare(b.id)
  })
  const total = filtered.length, pages = Math.max(1, Math.ceil(total / PAGE_SIZE)), page = Math.min(filters.page, pages)
  return { items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, pages, page }
}

export const formatDate = (value: string) => new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'))
export const formatMoney = (value: number, currency: string) => new Intl.NumberFormat('es-PE', { style: 'currency', currency, maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value)
export const titleCase = (value: string) => value.toLocaleLowerCase('es-PE').replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase('es-PE'))
