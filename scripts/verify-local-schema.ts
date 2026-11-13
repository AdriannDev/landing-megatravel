import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'

const root = process.cwd()
await mkdir('.qa', { recursive: true })
const directory = await mkdtemp(path.resolve('.qa/local-schema-'))
const filename = path.join(directory, 'test.db')
const env: NodeJS.ProcessEnv = { ...process.env, USE_SQLITE: 'true', NODE_ENV: 'test', SQLITE_URL: 'file:' + filename, PAYLOAD_SECRET: randomUUID() + randomUUID(), R2_BUCKET: '' }
const run = (overrides: Record<string, string> = {}) => {
  // Run outside the repo so all generated backups stay inside this fixture.
  const output = execFileSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), path.join(root, 'scripts/prepare-local-schema.ts')], { cwd: directory, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 60_000 })
  return JSON.parse(output.trim().split('\n').at(-1)!)
}
try {
  assert.equal(run({ USE_SQLITE: 'false', SQLITE_URL: 'libsql://invalid.test' }).status, 'skipped')
  assert.equal(run({ NODE_ENV: 'production', SQLITE_URL: 'libsql://invalid.test' }).status, 'skipped')
  assert.equal(run().status, 'ready')
  let db = new DatabaseSync(filename)
  try {
    for (const table of ['seat_pilot_pools', 'seat_pilot_reservations', 'seat_mail_events', 'mail_sync_cursors']) assert.ok(db.prepare('SELECT name FROM sqlite_master WHERE name=?').get(table))
    db.exec(`DROP INDEX seat_mail_events_source_key_idx;
      ALTER TABLE seat_mail_events DROP COLUMN source_key;
      ALTER TABLE seat_mail_events DROP COLUMN subject;
      ALTER TABLE seat_mail_events DROP COLUMN sender;
      ALTER TABLE seat_mail_events DROP COLUMN received_at;
      ALTER TABLE seat_mail_events DROP COLUMN seats;
      ALTER TABLE seat_mail_events DROP COLUMN status;
      ALTER TABLE seat_mail_events DROP COLUMN travel_date;
      ALTER TABLE seat_mail_events DROP COLUMN occurred_at;
      ALTER TABLE seat_mail_events DROP COLUMN version;
      ALTER TABLE seat_mail_events DROP COLUMN observation;
      INSERT INTO seat_mail_events(id,message_key,event_key,mtpe,reservation,outcome,reason,event,created_at,updated_at)
        VALUES(7,'mensaje-heredado','evento-heredado','50026','ANTERIOR','review','Revisar','{"mtpe":"50026"}','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z');`)
    db.exec(`PRAGMA foreign_keys=OFF;
      DROP TABLE audit_log;
      CREATE TABLE audit_log(id INTEGER PRIMARY KEY NOT NULL,departure_id TEXT NOT NULL,program TEXT NOT NULL,event TEXT NOT NULL,actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,actor_label TEXT NOT NULL,changes TEXT NOT NULL,updated_at TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE INDEX audit_log_departure_id_idx ON audit_log(departure_id);
      CREATE INDEX audit_log_actor_idx ON audit_log(actor_id);
      CREATE INDEX audit_log_updated_at_idx ON audit_log(updated_at);
      CREATE INDEX audit_log_created_at_idx ON audit_log(created_at);
      INSERT INTO audit_log VALUES(42,'salida-10','Anterior','updated',NULL,'Operaciones','{"price":{"before":100,"after":200}}','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z');
      CREATE TABLE __new_audit_log(id INTEGER PRIMARY KEY);
      DROP TABLE settings_blog_posts;
      DROP TABLE settings;
      CREATE TABLE settings(id INTEGER PRIMARY KEY NOT NULL,contact_url TEXT DEFAULT 'https://api.whatsapp.com/send?phone=51973473808' NOT NULL,contact_label TEXT DEFAULT 'Equipo comercial' NOT NULL,seats_validity_hours NUMERIC DEFAULT 72 NOT NULL,blog_last_synced_at TEXT,updated_at TEXT,created_at TEXT,featured_departure1_id INTEGER REFERENCES departures(id) ON DELETE SET NULL,featured_departure2_id INTEGER REFERENCES departures(id) ON DELETE SET NULL);
      CREATE INDEX settings_featured_departure1_idx ON settings(featured_departure1_id);
      CREATE INDEX settings_featured_departure2_idx ON settings(featured_departure2_id);
      INSERT INTO settings(id,contact_url,contact_label) VALUES(1,'https://example.test/contacto','Contacto');
      CREATE TABLE settings_blog_posts(_order INTEGER NOT NULL,_parent_id INTEGER NOT NULL REFERENCES settings(id) ON DELETE CASCADE,id TEXT PRIMARY KEY NOT NULL,source_id TEXT NOT NULL,title TEXT NOT NULL,category TEXT NOT NULL,date_label TEXT NOT NULL,href TEXT NOT NULL,image_url TEXT NOT NULL);
      CREATE INDEX settings_blog_posts_order_idx ON settings_blog_posts(_order);
      CREATE INDEX settings_blog_posts_parent_id_idx ON settings_blog_posts(_parent_id);
      INSERT INTO settings_blog_posts VALUES(1,1,'blog-anterior','1896','Artículo anterior','DESTINOS','07 nov, 2026','https://example.test/blog/1896','https://example.test/1896.png');
    `)
    for (const col of ['seat_pilot_pools_id','seat_pilot_reservations_id','seat_mail_events_id','mail_sync_cursors_id']) {
      // The old relation table had neither the columns nor their foreign keys.
      // Recreate with the old SQL definition, preserving every other field and constraint.
      const original = String(db.prepare("SELECT sql FROM sqlite_master WHERE name='payload_locked_documents_rels'").get()!.sql)
      assert.ok(original.includes(col))
    }
    const columns = db.prepare('PRAGMA table_info(payload_locked_documents_rels)').all().map(c => String(c.name)).filter(c => !['seat_pilot_pools_id','seat_pilot_reservations_id','seat_mail_events_id','mail_sync_cursors_id'].includes(c))
    const definitions = columns.map(c => `"${c}" ${c === 'id' ? 'INTEGER PRIMARY KEY NOT NULL' : c === 'path' ? 'TEXT NOT NULL' : c === 'parent_id' ? 'INTEGER NOT NULL' : 'INTEGER'}`)
    db.exec(`DROP TABLE payload_locked_documents_rels; CREATE TABLE payload_locked_documents_rels(${definitions.join(',')})`)
  } finally { db.close() }
  assert.equal(run().status, 'ready')
  const repeat = run(); assert.equal(repeat.preparation, null); assert.equal(repeat.backup, null)
  db = new DatabaseSync(filename)
  try {
    const audit = db.prepare('SELECT * FROM audit_log').get()!
    assert.equal(audit.id, 42); assert.equal(audit.departure_id, 'salida-10'); assert.equal(audit.entity_type, 'departure')
    assert.equal(audit.changes, '{"price":{"before":100,"after":200}}')
    assert.equal(db.prepare('PRAGMA table_info(audit_log)').all().find(c => c.name === 'departure_id')!.notnull, 0)
    const relations = db.prepare('PRAGMA foreign_key_list(payload_locked_documents_rels)').all()
    for (const table of ['seat_pilot_pools','seat_pilot_reservations','seat_mail_events','mail_sync_cursors']) assert.ok(relations.some(r => r.table === table))
    const blog = db.prepare('SELECT * FROM settings_blog_posts').get()!
    assert.equal(blog.id, 'blog-anterior'); assert.equal(blog.title, 'Artículo anterior'); assert.equal(blog.date_label, '07 nov, 2026')
    assert.equal(blog.image_url, 'https://example.test/1896.png'); assert.equal(blog.image_id, null)
    assert.equal(db.prepare('PRAGMA table_info(settings_blog_posts)').all().find(c => c.name === 'date_label')!.notnull, 0)
    assert.ok(db.prepare('PRAGMA foreign_key_list(settings_blog_posts)').all().some(r => r.from === 'image_id' && r.table === 'media'))
    const columns = db.prepare('PRAGMA table_info(settings)').all()
    for (const column of ['featured_departure1_id','featured_departure2_id']) assert.equal(columns.some(r => r.name === column), false)
    assert.equal(db.prepare('SELECT contact_label FROM settings WHERE id=1').get()!.contact_label, 'Contacto')
    const observed = db.prepare('SELECT * FROM seat_mail_events WHERE id=7').get()!
    assert.equal(observed.message_key, 'mensaje-heredado'); assert.equal(observed.event_key, 'evento-heredado')
    assert.equal(observed.reservation, 'ANTERIOR'); assert.equal(observed.reason, 'Revisar')
    for (const column of ['source_key','subject','sender','received_at','seats','status','travel_date','occurred_at','version','observation']) assert.equal(observed[column], null)
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok'); assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
    db.exec('CREATE TABLE __new_audit_log(id INTEGER PRIMARY KEY); INSERT INTO __new_audit_log VALUES(999)')
  } finally { db.close() }
  assert.throws(() => run(), /temporal.*contiene datos/)
  console.log('SQLite completo: base nueva, base antigua con historial y blog sin image_id, repetición sin cambios, relaciones e integridad, bloqueo de temporales con datos y exclusión de producción/PostgreSQL correctos.')
} finally {
  assert.ok(path.resolve(directory).startsWith(path.join(root, '.qa') + path.sep) && path.basename(directory).startsWith('local-schema-'))
  await rm(directory, { recursive: true, force: true })
}
