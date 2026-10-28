import type { Banner } from './types.ts'

export const POPUP_DAY_MS = 24 * 60 * 60 * 1000
export const popupStorageKey = (banner: Banner) => `megatravel:popup:${banner.id}:${banner.startsAt || 'initial'}`
export function shouldShowPopup(frequency: Banner['popupFrequency'], seen: string | null, now = Date.now()) {
  if (frequency === 'always' || !seen) return true
  const timestamp = Number(seen)
  if (!Number.isFinite(timestamp)) return true
  return frequency === 'daily' && now - timestamp >= POPUP_DAY_MS
}
