import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { BasePayload, type InitOptions, type Payload } from 'payload'

export async function withMailPilotPayload<T>(
  config: InitOptions['config'],
  run: (payload: Payload) => Promise<T>,
): Promise<T> {
  const payload = new BasePayload()
  let pool: PostgresAdapter['pool'] | undefined

  try {
    await payload.init({ config, disableDBConnect: true })
    const db = payload.db
    if (db.name === 'postgres') {
      if (!db.pg) throw new Error('El adaptador de PostgreSQL no tiene un controlador configurado.')
      // Payload 3.90.2 holds a client from pool.connect() when it creates its own pool.
      // Give the cron ownership of the pool so its lifetime ends with this run.
      pool = new db.pg.Pool(db.poolOptions)
      db.pool = pool
    }
    await db.connect?.()
    return await run(payload)
  } finally {
    try {
      await payload.destroy()
    } finally {
      await pool?.end()
    }
  }
}
