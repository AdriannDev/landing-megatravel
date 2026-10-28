import { createHash } from 'node:crypto'
import type { Payload, PayloadRequest } from 'payload'
import { departureKey, migrationGroups, normalizeMTPE, sharedData, sharedFields } from '../lib/programs.ts'
import { inTransaction } from './transactions.ts'

type Doc = Record<string, any>
export type ProgramMigrationBackup = { format: 1; createdAt: string; fingerprint: string; departures: Doc[]; programs: Doc[]; banners: Doc[] }
const fingerprint = (docs: unknown) => createHash('sha256').update(JSON.stringify(docs)).digest('hex')
export async function prepareProgramMigration(payload: Payload, req: PayloadRequest) {
  const previousContext = req.context
  try {
  const context = { skipProgramResolution: true }
  // Sequential reads keep a single SQLite connection safe as well as PostgreSQL.
  const departures = (await payload.find({ collection: 'departures', req, overrideAccess: true, depth: 0, pagination: false, sort: 'id', context })).docs
  const programs = (await payload.find({ collection: 'programs', req, overrideAccess: true, depth: 0, pagination: false, sort: 'id' })).docs
  const banners = (await payload.find({ collection: 'banners', req, overrideAccess: true, depth: 0, pagination: false, sort: 'id' })).docs
  const backup: ProgramMigrationBackup = { format: 1, createdAt: new Date().toISOString(), fingerprint: fingerprint({ departures, programs, banners }), departures, programs, banners }
  const groups = migrationGroups(departures, new Date(backup.createdAt))
  return { backup, report: groups.map(group => ({ mtpe: group.mtpe, sourceId: group.source.id, departures: group.departures.length, replacements: group.replacements })) }
  } finally { req.context = previousContext }
}

export async function applyProgramMigration(payload: Payload, req: PayloadRequest, backup: ProgramMigrationBackup, persist?: (result: { format: 1; fingerprint: string; createdPrograms: (number | string)[]; changes: { id: number | string; before: Doc; after: Doc }[]; banners: { id: number | string; before: Doc; after: Doc }[]; appliedAt: string }) => Promise<void>) {
  if (backup.format !== 1 || fingerprint({ departures: backup.departures, programs: backup.programs, banners: backup.banners }) !== backup.fingerprint) throw new Error('Respaldo de migración inválido.')
  return inTransaction(req, async () => {
    const current = await prepareProgramMigration(payload, req)
    if (current.backup.fingerprint !== backup.fingerprint) throw new Error('Los datos cambiaron después del respaldo. Prepara una nueva migración.')
    const createdPrograms: (number | string)[] = [], changes: { id: number | string; before: Doc; after: Doc }[] = [], banners: { id: number | string; before: Doc; after: Doc }[] = []
    const keys = new Set<string>()
    for (const doc of backup.departures) if (doc.departureKey) keys.add(doc.departureKey)
    for (const group of migrationGroups(backup.departures, new Date(backup.createdAt))) {
      const pending = group.departures.filter(doc => !doc.programRef)
      if (!pending.length) continue
      let program = backup.programs.find(p => normalizeMTPE(p.mtpe) === group.mtpe)
      if (!program) {
        program = await payload.db.create({ collection: 'programs', req, data: { ...sharedData(group.source), mtpe: group.mtpe, createdAt: backup.createdAt, updatedAt: backup.createdAt } })
        createdPrograms.push(program!.id)
      }
      for (const doc of pending) {
        const key = departureKey(group.mtpe, doc.origin, doc.travelDate)
        const before = { ...sharedData(doc), programRef: doc.programRef ?? null, departureKey: doc.departureKey ?? null, updatedAt: doc.updatedAt }
        const after = { ...sharedData(program!), programRef: program!.id, departureKey: keys.has(key) ? null : key, updatedAt: doc.updatedAt }
        keys.add(key)
        await payload.db.updateOne({ collection: 'departures', id: doc.id, req, data: after })
        changes.push({ id: doc.id, before, after })
      }
    }
    for (const banner of backup.banners.filter(b => !b.placement)) {
      const before = { placement: banner.placement ?? null, updatedAt: banner.updatedAt }, after = { placement: 'hero', updatedAt: banner.updatedAt }
      await payload.db.updateOne({ collection: 'banners', id: banner.id, req, data: after }); banners.push({ id: banner.id, before, after })
    }
    const result = { format: 1 as const, fingerprint: backup.fingerprint, createdPrograms, changes, banners, appliedAt: new Date().toISOString() }
    if (persist) await persist(result) // Persist undo data before the transaction commits.
    return result
  })
}

export async function revertProgramMigration(payload: Payload, req: PayloadRequest, backup: ProgramMigrationBackup, applied: Awaited<ReturnType<typeof applyProgramMigration>>) {
  if (backup.fingerprint !== applied.fingerprint || applied.format !== 1) throw new Error('El respaldo no corresponde a esta migración.')
  return inTransaction(req, async () => {
    for (const [collection, entries] of [['departures', applied.changes], ['banners', applied.banners]] as const) {
      for (const entry of entries) {
        const previousContext = req.context
        let doc: Doc
        try { doc = await payload.findByID({ collection, id: entry.id, req, overrideAccess: true, depth: 0, context: { skipProgramResolution: true } }) as Doc }
        finally { req.context = previousContext }
        const matches = (expected: Doc) => Object.entries(expected).every(([key, value]) => JSON.stringify(doc[key] ?? null) === JSON.stringify(value ?? null))
        if (matches(entry.before)) continue // A repeated rollback is harmless.
        if (!matches(entry.after)) throw new Error(`La ${collection === 'departures' ? 'salida' : 'campaña'} ${entry.id} cambió después de migrar. No se sobrescribió.`)
        await payload.db.updateOne({ collection, id: entry.id, req, data: entry.before })
      }
    }
    for (const id of applied.createdPrograms) {
      const exists = await payload.find({ collection: 'programs', req, overrideAccess: true, depth: 0, where: { id: { equals: id } }, limit: 1 })
      if (!exists.docs.length) continue
      if (exists.docs[0].updatedAt !== backup.createdAt) throw new Error(`El programa ${id} fue editado después de migrar; no se puede revertir automáticamente.`)
      if ((await payload.count({ collection: 'departures', req, overrideAccess: true, where: { programRef: { equals: id } } })).totalDocs) throw new Error(`El programa ${id} tiene nuevas salidas. No se eliminó.`)
      await payload.db.deleteOne({ collection: 'programs', where: { id: { equals: id } }, req })
    }
    return { restored: applied.changes.length, banners: applied.banners.length }
  })
}
