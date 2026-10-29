import type { Banner } from './types.ts'

export const POPUP_DAY_MS = 24 * 60 * 60 * 1000
export const popupStorageKey = (banner: Banner) => `megatravel:popup:${banner.id}:${banner.startsAt || 'initial'}`

export function popupTimeRemaining(endsAt: Banner['endsAt'], now = Date.now()) {
  if (!endsAt) return null
  const deadline = Date.parse(endsAt)
  if (!Number.isFinite(deadline) || deadline <= now) return null
  const seconds = Math.ceil((deadline - now) / 1000)
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60,
    seconds: seconds % 60,
  }
}

export function shouldShowPopup(frequency: Banner['popupFrequency'], seen: string | null, now = Date.now()) {
  if (frequency === 'always' || !seen) return true
  const timestamp = Number(seen)
  if (!Number.isFinite(timestamp)) return true
  return frequency === 'daily' && now - timestamp >= POPUP_DAY_MS
}
