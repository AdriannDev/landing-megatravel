export type Status = 'draft' | 'published' | 'withdrawn'
export type WithdrawalReason = 'request' | 'sold-out' | 'price-change' | 'other' | 'automatic'
export interface Promotion {
  id: string
  name: string
  label: string
  startsAt?: string | null
  endsAt?: string | null
}
export interface Departure {
  id: string
  program: string
  mtpe: string
  destination: string
  zone: string
  origin: string
  cruiseLine?: string | null
  days: number
  nights?: number | null
  travelDate: string
  price: number
  currency: 'USD' | 'PEN'
  priceCondition: string
  flyerUrl: string
  bookingUrl: string
  descriptionUrl: string
  promotions: Promotion[]
  priority: number
  status: Status
  advanceDays: number
  withdrawalAt: string
  withdrawalReason?: WithdrawalReason | null
  withdrawalNote?: string | null
  retiredAt?: string | null
  sourceKey?: string
  sourceSheet?: string
  sourceRef?: string
  sourceRetirementDate?: string | null
  sourceRetirementRaw?: string | null
}
export type PublicPackage = Pick<Departure,
  'id' | 'program' | 'mtpe' | 'destination' | 'zone' | 'origin' | 'cruiseLine' | 'days' | 'nights' |
  'travelDate' | 'price' | 'currency' | 'priceCondition' | 'flyerUrl' | 'bookingUrl' | 'descriptionUrl' | 'promotions' | 'priority'>
export interface Banner {
  id: string
  imageUrl: string
  mobileUrl?: string | null
  staticUrl: string
  alt: string
  href?: string | null
  startsAt?: string | null
  endsAt?: string | null
}
export interface CatalogData {
  packages: PublicPackage[]
  promotions: Promotion[]
  banners: Banner[]
  contactUrl: string
  contactLabel: string
}
export interface CatalogFilters {
  q: string
  zones: string[]
  destinations: string[]
  origins: string[]
  months: string[]
  programs: string[]
  promotions: string[]
  cruiseLines: string[]
  from: string
  to: string
  sort: 'featured' | 'date' | 'price-asc' | 'price-desc' | 'duration'
  page: number
}
