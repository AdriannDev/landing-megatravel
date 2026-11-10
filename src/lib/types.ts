import type { PublicAvailability } from './availability'
import type { PublicNewBadge } from './new-badge'
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
  videoUrl?: string | null
  bookingUrl: string
  descriptionUrl: string
  promotions: Promotion[]
  priority: number
  availableSeats?: number | null
  lastSeats?: boolean | null
  seatsCheckedAt?: string | null
  programLastSeats?: boolean | null
  lastSeatsCheckedAt?: string | null
  newBadge?: boolean | null
  newBadgeLabel?: string | null
  newBadgeUntil?: string | null
  programNewBadge?: boolean | null
  programNewBadgeLabel?: string | null
  programNewBadgeUntil?: string | null
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
  'travelDate' | 'price' | 'currency' | 'priceCondition' | 'flyerUrl' | 'videoUrl' | 'bookingUrl' | 'descriptionUrl' | 'promotions' | 'priority'> & { availability?: PublicAvailability | null; newBadge?: PublicNewBadge | null }
export type BannerPlacement = 'hero' | 'between-results' | 'catalog-end' | 'popup'
export interface Banner {
  id: string
  title?: string | null
  message?: string | null
  buttonLabel?: string | null
  popupFormat?: 'text' | 'image' | null
  popupLabel?: string | null
  popupSecondaryLabel?: string | null
  popupKind?: 'promotion' | 'news' | null
  popupFrequency?: 'session' | 'daily' | 'always' | null
  popupDelay?: number | null
  placement?: BannerPlacement
  order?: number
  imageUrl: string
  mobileUrl?: string | null
  staticUrl: string
  alt: string
  href?: string | null
  startsAt?: string | null
  endsAt?: string | null
  countdownEnabled?: boolean | null
  countdownEndsAt?: string | null
}
export interface BlogPost {
  sourceId: string
  title: string
  category: string
  dateLabel: string
  href: string
  imageUrl: string
}
export interface CatalogData {
  packages: PublicPackage[]
  promotions: Promotion[]
  banners: Banner[]
  blogPosts: BlogPost[]
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
