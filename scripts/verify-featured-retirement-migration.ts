import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { PgDialect } from '@payloadcms/db-postgres/drizzle/pg-core'
import { migrations } from '../src/migrations'

const pg = new PGlite()
const dialect = new PgDialect()
const args = { db: { execute: async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
  const built = dialect.sqlToQuery(query)
  assert.equal(built.params.length, 0)
  return pg.exec(built.sql)
} } } as unknown as Parameters<(typeof migrations)[0]['up']>[0]
const transaction = async (run: () => Promise<void>) => {
  await pg.exec('BEGIN')
  try { await run(); await pg.exec('COMMIT') }
  catch (error) { await pg.exec('ROLLBACK'); throw error }
}
try {
  const last = migrations.at(-1)!
  assert.match(last.name, /remove_featured_departures/)
  for (const migration of migrations.slice(0, -1)) await transaction(() => migration.up(args))
  await pg.exec(`INSERT INTO origins(name) VALUES('Lima');
    INSERT INTO destinations(name) VALUES('Madrid');
    INSERT INTO media(alt,filename,mime_type) VALUES('Miniatura','blog.webp','image/webp');
    INSERT INTO programs(program,mtpe,destination_id,zone,days) VALUES('Conservar','50026',1,'Europa',8);
    INSERT INTO departures(program_ref_id,origin_id,travel_date,price,available_seats,seats_reconciled_quantity,seats_reconciled_at) VALUES(1,1,'2026-11-21',2000,12,12,now());
    INSERT INTO settings(id,contact_url,contact_label,seats_validity_hours,blog_last_synced_at,featured_departure1_id,featured_departure2_id) VALUES(42,'https://example.test/contacto','Ventas',24,now(),1,1);
    INSERT INTO settings_blog_posts(_order,_parent_id,id,source_id,title,category,date_label,href,image_url,image_id) VALUES(1,42,'blog-original','1896','Artículo','DESTINOS',NULL,'https://example.test/blog','https://example.test/blog.webp',1);
    INSERT INTO seat_mail_events(message_key,event_key,source_key,outcome,reason) VALUES('known-message','known-event','known-source','review','Falta el estado.');
    INSERT INTO mail_sync_cursors(key,provider,uid_validity,last_uid) VALUES('original-mailbox','gmail-imap','123',42);`)
  const tables = (await pg.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).rows.map(row => row.table_name)
  const originals = new Map<string, Record<string, unknown>[]>()
  for (const table of tables) originals.set(table, (await pg.query<Record<string, unknown>>(`SELECT * FROM "${table}"`)).rows)
  await transaction(() => last.up(args))
  for (const [table, rows] of originals) {
    const expected = rows.map(row => Object.fromEntries(Object.entries(row).filter(([column]) => table !== 'settings' || !['featured_departure1_id', 'featured_departure2_id'].includes(column))))
    assert.deepEqual((await pg.query(`SELECT * FROM "${table}"`)).rows, expected, table)
  }
  assert.equal((await pg.query("SELECT column_name FROM information_schema.columns WHERE table_name='settings' AND column_name LIKE 'featured_departure%'")).rows.length, 0)
  assert.equal((await pg.query("SELECT indexname FROM pg_indexes WHERE tablename='settings' AND indexname LIKE '%featured%'")).rows.length, 0)
  assert.equal((await pg.query("SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='settings' AND constraint_type='FOREIGN KEY'")).rows.length, 0)
  await transaction(() => last.down(args))
  assert.deepEqual((await pg.query('SELECT featured_departure1_id,featured_departure2_id FROM settings')).rows, [{ featured_departure1_id: null, featured_departure2_id: null }])
  await transaction(() => last.up(args))
  assert.equal((await pg.query<{ image_id: number }>('SELECT image_id FROM settings_blog_posts')).rows[0].image_id, 1)
  assert.equal((await pg.query<{ last_uid: string }>('SELECT last_uid FROM mail_sync_cursors')).rows[0].last_uid, '42')
  // The new Drizzle snapshot has exactly the same schema delta as the SQL.
  const before = JSON.parse(await readFile(new URL('../src/migrations/20261113_180329_independent_departure_seats.json', import.meta.url), 'utf8'))
  const after = JSON.parse(await readFile(new URL('../src/migrations/20261113_220000_remove_featured_departures.json', import.meta.url), 'utf8'))
  for (const key of ['featured_departure1_id', 'featured_departure2_id']) delete before.tables['public.settings'].columns[key]
  for (const key of ['settings_featured_departure1_idx', 'settings_featured_departure2_idx']) delete before.tables['public.settings'].indexes[key]
  for (const key of ['settings_featured_departure1_id_departures_id_fk', 'settings_featured_departure2_id_departures_id_fk']) delete before.tables['public.settings'].foreignKeys[key]
  assert.deepEqual(after.tables, before.tables)
  console.log('PGlite: cadena completa; retirada exclusiva de fijaciones; blog, imágenes, configuración, datos, identificadores y cursores conservados; reversión de esquema y reaplicación correctas.')
} finally { await pg.close() }
