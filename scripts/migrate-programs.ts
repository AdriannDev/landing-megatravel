import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createLocalReq, getPayload } from 'payload'
import config from '../src/payload.config'
import { applyProgramMigration, prepareProgramMigration, revertProgramMigration } from '../src/server/program-migration'
import type { SQLiteAdapter } from '@payloadcms/db-sqlite'
import { DatabaseSync, backup as copySqlite } from 'node:sqlite'
import { applySqliteSchemaPlan, prepareLegacySqliteSchema } from './prepare-sqlite-schema'

if (process.env.USE_SQLITE === 'true' && (process.env.SQLITE_URL || 'file:./megatravel.db').startsWith('file:')) {
  process.env.PAYLOAD_MIGRATING = 'true'
  const preparation = await prepareLegacySqliteSchema(path.resolve((process.env.SQLITE_URL || 'file:./megatravel.db').slice(5)))
  if (preparation) console.log(`Esquema SQLite preparado: ${preparation.columnsAdded} columnas. Copia completa previa: ${preparation.backup}`)
}
const payload = await getPayload({ config })
try {
  if (payload.db.name === 'sqlite') {
    const adapter = payload.db as unknown as SQLiteAdapter
    // Drizzle's public declaration omits statementsToExecute, which its SQLite
    // implementation returns; keep that adapter boundary explicit here.
    const kit = adapter.requireDrizzleKit() as unknown as { pushSchema: (schema: unknown, db: unknown) => Promise<{ hasDataLoss: boolean; warnings: string[]; statementsToExecute: string[] }> }
    const plan = await kit.pushSchema(adapter.schema, adapter.drizzle)
    if (plan.hasDataLoss || plan.warnings.length) throw new Error('El esquema SQLite presenta advertencias; revisa la copia antes de aplicarlo.')
    const file = await applySqliteSchemaPlan(path.resolve((process.env.SQLITE_URL || 'file:./megatravel.db').slice(5)), plan.statementsToExecute)
    if (file) console.log(`Esquema actualizado sin alterar datos originales. Respaldo completo: ${file}`)
  }
  const req = await createLocalReq({}, payload)
  const root = path.resolve('backups')
  await mkdir(root, { recursive: true })
  if (process.argv.includes('--down')) {
    const argument = process.argv.find(a => a.endsWith('.backup.json'))
    const file = path.resolve(argument || '')
    if (!argument || !file.startsWith(root + path.sep)) throw new Error('Indica un respaldo .backup.json dentro de backups/.')
    const backup = JSON.parse(await readFile(file, 'utf8')), applied = JSON.parse(await readFile(file.replace('.backup.json', '.applied.json'), 'utf8'))
    console.log(await revertProgramMigration(payload, req, backup, applied))
  } else {
    const { backup, report } = await prepareProgramMigration(payload, req)
    const prefix = path.join(root, 'programas-' + backup.createdAt.replace(/[:.]/g, '-'))
    await writeFile(prefix + '.backup.json', JSON.stringify(backup, null, 2), { flag: 'wx' })
    await writeFile(prefix + '.report.json', JSON.stringify(report, null, 2), { flag: 'wx' })
    console.log(`Respaldo: ${prefix}.backup.json. Reporte: ${prefix}.report.json`)
    if (process.argv.includes('--commit')) {
      if (payload.db.name === 'sqlite' && (process.env.SQLITE_URL || 'file:./megatravel.db').startsWith('file:')) {
        const sqliteBackup = prefix + '.sqlite.db'
        const source = new DatabaseSync(path.resolve((process.env.SQLITE_URL || 'file:./megatravel.db').slice(5)), { readOnly: true })
        try { await copySqlite(source, sqliteBackup) } finally { source.close() }
        console.log(`Copia SQLite completa, incluidas versiones e historial: ${sqliteBackup}`)
      }
      const applied = await applyProgramMigration(payload, req, backup, result => writeFile(prefix + '.applied.json', JSON.stringify(result, null, 2), { flag: 'wx' }))
      console.log(`Migración aplicada: ${applied.createdPrograms.length} programas, ${applied.changes.length} salidas. Fechas, precios, estados, versiones e historial conservados.`)
    } else console.log('Solo preparación. Revisa el reporte y ejecuta de nuevo con --commit para migrar.')
  }
} finally { await payload.destroy() }
