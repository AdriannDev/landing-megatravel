import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { PgDialect } from '@payloadcms/db-postgres/drizzle/pg-core'
import { migrations } from '../src/migrations'
const pg = new PGlite()
const dialect = new PgDialect()
const db = { execute: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
  const built = dialect.sqlToQuery(query)
  assert.equal(built.params.length, 0)
  return pg.exec(built.sql)
} }
const args = { db } as unknown as Parameters<(typeof migrations)[0]['up']>[0]
const transaction = async (run: () => Promise<void>) => {
  await pg.exec('BEGIN')
  try { await run(); await pg.exec('COMMIT') }
  catch (error) { await pg.exec('ROLLBACK'); throw error }
}
try {
  for (const migration of migrations.slice(0, -1)) await transaction(() => migration.up(args))
  await pg.exec(`INSERT INTO origins(name) VALUES('Lima');
    INSERT INTO destinations(name) VALUES('Madrid');
    INSERT INTO programs(program,mtpe,destination_id,zone,days,available_seats,last_seats) VALUES('Original','MTPE-50026',1,'Europa',8,15,true);
    INSERT INTO departures(program_ref_id,origin_id,travel_date,price,available_seats,last_seats) VALUES(1,1,'2035-06-21',2000,12,true);
    INSERT INTO _departures_v(parent_id,version_origin_id,version_travel_date,version_price,version_available_seats) VALUES(1,1,'2035-06-21',2000,12);
    INSERT INTO seat_pilot_pools(mtpe,program_id,program_created_at,program_name,initial_seats,remaining_seats,cutoff_at,actor_label) VALUES('50026','1',now(),'Original',15,12,now(),'QA');
    INSERT INTO seat_pilot_reservations(key,mtpe,reservation,state) VALUES('original-key','50026','MTP-12345','{"occupiedSeats":3}');
    INSERT INTO seat_mail_events(message_key,event_key,source_key,outcome,reason) VALUES('known-message','known-event','known-source','proposed','Original');
    INSERT INTO mail_sync_cursors(key,provider,uid_validity,last_uid) VALUES('original-mailbox','gmail-imap','123',42);
    INSERT INTO payload_preferences(key,value) VALUES('collection-departures','{"sort":"-price","limit":25,"columns":[{"accessor":"program","active":true},{"accessor":"origin","active":true},{"accessor":"price","active":false}]}');`)
  const tables = ['programs', 'departures', '_departures_v', 'seat_pilot_pools', 'seat_pilot_reservations', 'seat_mail_events', 'mail_sync_cursors']
  const originals = new Map<string, Record<string, unknown>[]>()
  for (const table of tables) originals.set(table, (await pg.query<Record<string, unknown>>(`SELECT * FROM ${table}`)).rows)
  const migration = migrations.at(-1)!
  assert.match(migration.name, /independent_departure_seats/)
  await transaction(() => migration.up(args))
  for (const [table, before] of originals) {
    const after = (await pg.query<Record<string, unknown>>(`SELECT * FROM ${table}`)).rows
    assert.equal(after.length, before.length)
    for (let i = 0; i < before.length; i++) for (const [key, value] of Object.entries(before[i])) assert.deepEqual(after[i][key], value, `${table}.${key}`)
  }
  assert.equal((await pg.query<{ seats_reconciled_at: string | null }>('SELECT seats_reconciled_at FROM departures')).rows[0].seats_reconciled_at, null)
  assert.equal((await pg.query<{ departure_stable_id: string | null }>('SELECT departure_stable_id FROM seat_pilot_pools')).rows[0].departure_stable_id, null)
  const pref = (await pg.query<{ value: any }>('SELECT value FROM payload_preferences')).rows[0].value
  assert.equal(pref.sort, '-price'); assert.equal(pref.limit, 25)
  assert.deepEqual(pref.columns, [{ accessor: 'program', active: true }, { accessor: 'origin', active: true }, { accessor: 'availableSeats', active: true }, { accessor: 'price', active: false }])
  await pg.exec(`INSERT INTO seat_pilot_pools(mtpe,departure_stable_id,program_id,program_created_at,program_name,initial_seats,remaining_seats,cutoff_at,actor_label) VALUES('50026','july-original','1',now(),'Original',15,15,now(),'QA');
    UPDATE departures SET seats_reconciled_at=now(),seats_reconciled_quantity=12;`)
  await assert.rejects(transaction(() => migration.down(args)), /No se puede revertir/)
  await pg.exec(`DELETE FROM seat_pilot_pools WHERE departure_stable_id='july-original'; UPDATE departures SET seats_reconciled_at=null,seats_reconciled_quantity=null;`)
  await transaction(() => migration.down(args)); await transaction(() => migration.up(args))
  assert.equal((await pg.query<{ last_uid: string }>('SELECT last_uid FROM mail_sync_cursors')).rows[0].last_uid, '42')
  console.log('PostgreSQL embebido (PGlite): cadena completa, datos/IDs/historial/reservas/deduplicación/cursores conservados, preferencias, saldos simulados por salida, reversión protegida y reaplicación correctos.')
} finally { await pg.close() }
