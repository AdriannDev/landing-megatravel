import { isPublishable } from './lifecycle.ts'

// Legacy fields remain as searchable snapshots and to preserve existing versions.
export const sharedFields = ['program', 'mtpe', 'destination', 'zone', 'days', 'nights', 'cruiseLine', 'flyer', 'flyerSourceUrl', 'flyerDownloadWarning', 'bookingUrl', 'descriptionUrl'] as const
export const normalizeMTPE = (value: unknown) => String(value ?? '').trim().toUpperCase()
export const relationID = (value: any): string | number | null => value && typeof value === 'object' ? value.id ?? null : value ?? null
export const sharedData = (doc: Record<string, any>) => Object.fromEntries(sharedFields.map(key => [key, key === 'mtpe' ? normalizeMTPE(doc[key]) : doc[key] ?? null]))
export const departureKey = (mtpe: unknown, origin: unknown, date: string) => JSON.stringify([normalizeMTPE(mtpe), String(relationID(origin)), date])

export function resolveProgram(doc: Record<string, any>): Record<string, any> {
  const program = doc.programRef
  return program && typeof program === 'object' ? { ...doc, ...sharedData(program) } : doc
}

export function migrationGroups(docs: Record<string, any>[], now = new Date()) {
  const groups = new Map<string, Record<string, any>[]>()
  for (const doc of docs) {
    const mtpe = normalizeMTPE(doc.mtpe)
    if (!mtpe) throw new Error(`La salida ${doc.id} no tiene MTPE; corrígela antes de migrar.`)
    groups.set(mtpe, [...(groups.get(mtpe) || []), doc])
  }
  return [...groups].map(([mtpe, departures]) => {
    const ranked = [...departures].sort((a, b) => Number(isPublishable(b as any, now)) - Number(isPublishable(a as any, now)) || Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || String(b.id).localeCompare(String(a.id), 'en', { numeric: true }))
    const source = ranked[0]
    return { mtpe, source, departures, replacements: departures.flatMap(doc => sharedFields.filter(key => JSON.stringify(relationID(doc[key])) !== JSON.stringify(relationID(source[key]))).map(field => ({ id: doc.id, field, before: doc[field] ?? null, after: source[field] ?? null }))) }
  })
}
