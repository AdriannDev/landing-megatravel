import type { Banner, BannerPlacement } from './types.ts'
import { isActivePeriod } from './lifecycle.ts'

export function bannersAt(banners: Banner[], placement: BannerPlacement, now = new Date()) {
  return banners.filter(b => (b.placement || 'hero') === placement && isActivePeriod(b, now)).sort((a, b) => (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id, 'en', { numeric: true }))
}
