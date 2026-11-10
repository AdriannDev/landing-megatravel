import { commitTransaction, initTransaction, killTransaction, type PayloadRequest } from 'payload'
import { sql } from '@payloadcms/db-postgres'

const sqliteQueues = new WeakMap<object, Promise<void>>()

export async function postgresTransaction(req: PayloadRequest) {
  const transactionID = await req.transactionID
  const executor = transactionID == null ? undefined : req.payload.db.sessions?.[transactionID]?.db
  if (!executor) throw new Error('No existe la sesión de transacción de PostgreSQL.')
  return executor as { execute(query: ReturnType<typeof sql>): Promise<unknown> }
}
export async function lockCommercialRecords(req: PayloadRequest, table: 'programs' | 'departures', ids: (string | number)[]) {
  if (req.payload.db.name !== 'postgres' || !ids.length) return // SQLite begins an IMMEDIATE write transaction.
  await (await postgresTransaction(req)).execute(sql`SELECT id FROM ${sql.identifier(table)} WHERE id::text IN (${sql.join(ids.map(id => sql`${String(id)}`), sql`, `)}) ORDER BY id FOR UPDATE`)
}

export async function inTransaction<T>(req: PayloadRequest, run: () => Promise<T>): Promise<T> {
  // libsql's local BEGIN IMMEDIATE is synchronous: a second begin blocks the event
  // loop before the first transaction can commit. Queue local writers before BEGIN.
  // PostgreSQL uses DB locks and never relies on this process-local queue.
  if (req.payload.db.name === 'sqlite' && req.transactionID == null) {
    const previous = sqliteQueues.get(req.payload) || Promise.resolve()
    let release!: () => void
    const current = new Promise<void>(resolve => { release = resolve })
    const tail = previous.then(() => current)
    sqliteQueues.set(req.payload, tail)
    await previous
    try { return await executeTransaction(req, run) }
    finally { release(); if (sqliteQueues.get(req.payload) === tail) sqliteQueues.delete(req.payload) }
  }
  return executeTransaction(req, run)
}
async function executeTransaction<T>(req: PayloadRequest, run: () => Promise<T>): Promise<T> {
  const owned = await initTransaction(req)
  if (!req.transactionID || await req.transactionID == null) throw new Error('La base debe admitir transacciones para completar la operación sin registros parciales.')
  try {
    const result = await run()
    if (owned) await commitTransaction(req)
    return result
  } catch (error) {
    if (owned) await killTransaction(req)
    throw error
  }
}
