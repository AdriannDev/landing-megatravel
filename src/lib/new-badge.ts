// «Nuevo» badge: program-wide option plus an optional per-date override, like «Últimos cupos».
export const DEFAULT_NEW_BADGE_LABEL = 'NUEVO'
export const NEW_BADGE_MAX_LENGTH = 24

export interface NewBadgeSource {
  newBadge?: boolean | null
  newBadgeLabel?: string | null
  newBadgeUntil?: string | null
  programNewBadge?: boolean | null
  programNewBadgeLabel?: string | null
  programNewBadgeUntil?: string | null
}
export interface PublicNewBadge { label: string }

const clean = (value: unknown) => String(value ?? '').trim().slice(0, NEW_BADGE_MAX_LENGTH)
// «Mostrar hasta» is exclusive; an invalid date never hides the badge silently.
const active = (enabled: unknown, until: unknown, now: number) => {
  if (enabled !== true) return false
  if (!until) return true
  const end = Date.parse(String(until))
  return Number.isNaN(end) || end > now
}

export function publicNewBadge(item: NewBadgeSource, now = Date.now()): PublicNewBadge | null {
  if (active(item.newBadge, item.newBadgeUntil, now))
    return { label: clean(item.newBadgeLabel) || clean(item.programNewBadgeLabel) || DEFAULT_NEW_BADGE_LABEL }
  if (active(item.programNewBadge, item.programNewBadgeUntil, now))
    return { label: clean(item.programNewBadgeLabel) || DEFAULT_NEW_BADGE_LABEL }
  return null
}

// Projected onto each departure when reading; not stored on departures.
export const programBadgeSnapshot = (program: Record<string, any>) => ({
  programNewBadge: program.newBadge === true,
  programNewBadgeLabel: program.newBadgeLabel ?? null,
  programNewBadgeUntil: program.newBadgeUntil ?? null,
})
