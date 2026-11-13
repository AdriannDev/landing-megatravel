import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SQLiteAdapter } from '@payloadcms/db-sqlite'
import { prepareSeatPreferences } from './prepare-seat-preferences.ts'
import { applySqliteSchemaPlan, prepareLegacySqliteSchema } from './prepare-sqlite-schema.ts'

// No Payload import/connection for PostgreSQL or production. Never run a dev push there.
export async function prepareLocalSchema() {
  if (process.env.USE_SQLITE !== 'true' || process.env.NODE_ENV === 'production') return { status: 'skipped' }
  const url = process.env.SQLITE_URL || 'file:./megatravel.db'
  if (!url.startsWith('file:') || !url.slice(5) || /[?#]/.test(url) || url.includes(':memory:') || /^[/\\]{2}/.test(url.slice(5)))
    throw new Error('db:prepare:local solo admite un archivo SQLite local persistente.')
  const filename = path.resolve(url.slice(5))
  const preparation = await prepareLegacySqliteSchema(filename)
  const previous = process.env.PAYLOAD_MIGRATING
  process.env.PAYLOAD_MIGRATING = 'true'
  let payload
  try {
    const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('../src/payload.config')])
    payload = await getPayload({ config })
    const adapter = payload.db as unknown as SQLiteAdapter
    const kit = adapter.requireDrizzleKit() as unknown as { pushSchema: (schema: unknown, db: unknown) => Promise<{ hasDataLoss: boolean; warnings: string[]; statementsToExecute: string[] }> }
    const plan = await kit.pushSchema(adapter.schema, adapter.drizzle)
    if (plan.hasDataLoss || plan.warnings.length) throw new Error('El esquema presenta cambios potencialmente destructivos. Arranque detenido; revisa el respaldo y el esquema.')
    const backup = await applySqliteSchemaPlan(filename, plan.statementsToExecute)
    const preferencesUpdated = await prepareSeatPreferences(filename)
    return { status: 'ready', preparation, backup: backup || null, preferencesUpdated }
  } finally {
    await payload?.destroy()
    if (previous === undefined) delete process.env.PAYLOAD_MIGRATING
    else process.env.PAYLOAD_MIGRATING = previous
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await prepareLocalSchema())) }
  catch (error) { console.error((error as Error).message); process.exitCode = 1 }
}
