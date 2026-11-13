import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { prepareLegacySqliteSchema, applySqliteSchemaPlan } from '../scripts/prepare-sqlite-schema.ts'
import { prepareSeatPreferences } from '../scripts/prepare-seat-preferences.ts'

const fixture = async run => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sqlite-schema-')), file = path.join(directory, 'test.db')
  const previousDirectory = process.cwd()
  process.chdir(directory)
  const db = new DatabaseSync(file)
  try { await run(db, file) } finally {
    db.close(); process.chdir(previousDirectory)
    assert.ok(path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(directory).startsWith('sqlite-schema-'))
    await rm(directory, { recursive: true, force: true })
  }
}
const oldSchema = `CREATE TABLE audit_log(id INTEGER PRIMARY KEY,departure_id TEXT NOT NULL,changes TEXT NOT NULL);
 CREATE INDEX audit_log_departure_id_idx ON audit_log(departure_id);
 INSERT INTO audit_log VALUES(9,'old-42','{"price":1234}');
 CREATE TABLE payload_locked_documents_rels(id INTEGER PRIMARY KEY,parent_id INTEGER NOT NULL,path TEXT NOT NULL);
 INSERT INTO payload_locked_documents_rels VALUES(1,5,'document');`

test('prepara base antigua con WAL y reconstrucción interrumpida, conserva datos, índices y respaldo', () => fixture(async (db, file) => {
  db.exec('PRAGMA journal_mode=WAL'); db.exec(oldSchema)
  db.exec('CREATE TABLE __new_audit_log(id INTEGER PRIMARY KEY)')
  const original = db.prepare('SELECT * FROM audit_log').all()
  const result = await prepareLegacySqliteSchema(file)
  assert.equal(result.columnsAdded, 7)
  const copy = new DatabaseSync(result.backup, { readOnly: true })
  try { assert.deepEqual(copy.prepare('SELECT * FROM audit_log').all(), original); assert.ok(copy.prepare("SELECT name FROM sqlite_master WHERE name='__new_audit_log'").get()) } finally { copy.close() }
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='__new_audit_log'").get(), undefined)
  assert.deepEqual(db.prepare('SELECT id,departure_id,changes FROM audit_log').all(), original)
  assert.equal(db.prepare('SELECT entity_type FROM audit_log').get().entity_type, 'departure')
  assert.equal(await prepareLegacySqliteSchema(file), null)
  const rels = db.prepare('PRAGMA table_info(payload_locked_documents_rels)').all().map(c => c.name)
  for (const name of ['seat_pilot_pools_id','seat_pilot_reservations_id','seat_mail_events_id','mail_sync_cursors_id']) assert.ok(rels.includes(name))
  await applySqliteSchemaPlan(file, [
    'CREATE TABLE __new_audit_log(id INTEGER PRIMARY KEY,departure_id TEXT,changes TEXT NOT NULL,entity_type TEXT DEFAULT \'departure\',program_id TEXT)',
    'INSERT INTO __new_audit_log SELECT id,departure_id,changes,entity_type,program_id FROM audit_log',
    'DROP TABLE audit_log', 'ALTER TABLE __new_audit_log RENAME TO audit_log',
    'CREATE INDEX audit_log_departure_id_idx ON audit_log(departure_id)', 'CREATE INDEX audit_log_program_id_idx ON audit_log(program_id)',
  ])
  assert.equal(db.prepare('PRAGMA table_info(audit_log)').all().find(c => c.name === 'departure_id').notnull, 0)
  assert.deepEqual(db.prepare('SELECT id,departure_id,changes FROM audit_log').all(), original)
  db.exec("INSERT INTO audit_log(id,changes,entity_type,program_id) VALUES(10,'{}','program','1')")
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), [])
}))
test('rechaza tabla temporal con datos incluso sin columnas pendientes y revierte la preparación', () => fixture(async (db, file) => {
  db.exec(oldSchema); await prepareLegacySqliteSchema(file)
  db.exec('CREATE TABLE __new_audit_log(id INTEGER PRIMARY KEY); INSERT INTO __new_audit_log VALUES(99)')
  await assert.rejects(prepareLegacySqliteSchema(file), /temporal.*contiene datos/)
  assert.equal(db.prepare('SELECT id FROM __new_audit_log').get().id, 99)
}))
test('base nueva e idempotencia; revierte errores, cambios de datos, columnas, índices y FK', () => fixture(async (db, file) => {
  assert.equal(await prepareLegacySqliteSchema(file), null)
  await applySqliteSchemaPlan(file, ['CREATE TABLE parent(id INTEGER PRIMARY KEY)', 'CREATE TABLE child(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES parent(id))', 'CREATE INDEX child_parent_idx ON child(parent_id)', 'INSERT INTO parent VALUES(1)', 'INSERT INTO child VALUES(2,1)'])
  for (const statements of [
    ['UPDATE child SET parent_id=99'], ['DROP INDEX child_parent_idx'], ['DELETE FROM child'],
    ['ALTER TABLE child DROP COLUMN parent_id'], ['UPDATE child SET parent_id=1', 'INVALID SQL'],
  ]) await assert.rejects(applySqliteSchemaPlan(file, statements))
  assert.equal(db.prepare('SELECT parent_id FROM child').get().parent_id, 1)
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name='child_parent_idx'").get())
  assert.equal(await applySqliteSchemaPlan(file, []), undefined)
}))

test('prepara image_id del blog antes de reconstruir su fecha opcional', () => fixture(async (db, file) => {
  db.exec(`CREATE TABLE media(id INTEGER PRIMARY KEY);
    CREATE TABLE settings_blog_posts(id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL,date_label TEXT NOT NULL);
    CREATE INDEX blog_title_idx ON settings_blog_posts(title);
    INSERT INTO settings_blog_posts VALUES('anterior','Blog anterior','07 nov, 2026');
    CREATE TABLE __new_settings_blog_posts(id TEXT PRIMARY KEY);`)
  const original = db.prepare('SELECT * FROM settings_blog_posts').all()
  const result = await prepareLegacySqliteSchema(file)
  assert.equal(result.columnsAdded, 1)
  const copy = new DatabaseSync(result.backup, { readOnly: true })
  try {
    assert.deepEqual(copy.prepare('SELECT * FROM settings_blog_posts').all(), original)
    assert.ok(copy.prepare("SELECT name FROM sqlite_master WHERE name='__new_settings_blog_posts'").get())
  } finally { copy.close() }
  assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='__new_settings_blog_posts'").get(), undefined)
  await applySqliteSchemaPlan(file, [
    'CREATE TABLE __new_settings_blog_posts(id TEXT PRIMARY KEY NOT NULL,title TEXT NOT NULL,date_label TEXT,image_id INTEGER REFERENCES media(id) ON DELETE SET NULL)',
    'INSERT INTO __new_settings_blog_posts SELECT id,title,date_label,image_id FROM settings_blog_posts',
    'DROP TABLE settings_blog_posts', 'ALTER TABLE __new_settings_blog_posts RENAME TO settings_blog_posts',
    'CREATE INDEX blog_title_idx ON settings_blog_posts(title)',
  ])
  assert.deepEqual(db.prepare('SELECT id,title,date_label FROM settings_blog_posts').all(), original)
  assert.equal(db.prepare('SELECT image_id FROM settings_blog_posts').get().image_id, null)
  db.exec("INSERT INTO media VALUES(12); UPDATE settings_blog_posts SET image_id=12,date_label=NULL")
  assert.equal(await prepareLegacySqliteSchema(file), null)
  assert.equal(db.prepare('SELECT image_id FROM settings_blog_posts').get().image_id, 12)
  db.exec("CREATE TABLE __new_settings_blog_posts(id TEXT PRIMARY KEY); INSERT INTO __new_settings_blog_posts VALUES('pendiente')")
  await assert.rejects(prepareLegacySqliteSchema(file), /temporal.*contiene datos/)
  assert.equal(db.prepare('SELECT id FROM __new_settings_blog_posts').get().id, 'pendiente')
}))

test('añade conciliaciones sin asociar historial ni trasladar saldos y actualiza preferencias una sola vez', () => fixture(async (db, file) => {
  db.exec(`CREATE TABLE departures(id INTEGER PRIMARY KEY,available_seats NUMERIC,last_seats INTEGER,seats_checked_at TEXT);
    INSERT INTO departures VALUES(8,12,1,'2026-11-13T00:00:00Z');
    CREATE TABLE seat_pilot_pools(id INTEGER PRIMARY KEY,mtpe TEXT,remaining_seats NUMERIC);
    CREATE UNIQUE INDEX seat_pilot_pools_mtpe_idx ON seat_pilot_pools(mtpe);
    INSERT INTO seat_pilot_pools VALUES(5,'50026',12);
    CREATE TABLE seat_mail_events(id INTEGER PRIMARY KEY,message_key TEXT,event TEXT);
    INSERT INTO seat_mail_events VALUES(9,'known-message','{"seats":3}');
    CREATE TABLE payload_preferences(id INTEGER PRIMARY KEY,key TEXT,value TEXT);
    INSERT INTO payload_preferences VALUES(1,'collection-departures','{"sort":"-price","columns":[{"accessor":"origin","active":true},{"accessor":"price","active":false}]}');`)
  await prepareLegacySqliteSchema(file)
  assert.equal(db.prepare('SELECT available_seats FROM departures').get().available_seats, 12)
  assert.equal(db.prepare('SELECT seats_reconciled_at FROM departures').get().seats_reconciled_at, null)
  assert.equal(db.prepare('SELECT departure_stable_id FROM seat_pilot_pools').get().departure_stable_id, null)
  assert.equal(db.prepare('SELECT message_key FROM seat_mail_events').get().message_key, 'known-message')
  await applySqliteSchemaPlan(file, ['DROP INDEX seat_pilot_pools_mtpe_idx', 'CREATE INDEX seat_pilot_pools_mtpe_idx ON seat_pilot_pools(mtpe)'])
  assert.equal(db.prepare('SELECT remaining_seats FROM seat_pilot_pools').get().remaining_seats, 12)
  assert.equal(await prepareSeatPreferences(file), 1)
  let prefs = JSON.parse(db.prepare('SELECT value FROM payload_preferences').get().value)
  assert.equal(prefs.sort, '-price')
  assert.deepEqual(prefs.columns, [{ accessor: 'origin', active: true }, { accessor: 'availableSeats', active: true }, { accessor: 'price', active: false }])
  // The editor can hide the new column later; a second startup preserves that choice.
  prefs.columns[1].active = false
  db.prepare('UPDATE payload_preferences SET value=?').run(JSON.stringify(prefs))
  assert.equal(await prepareSeatPreferences(file), 0)
  assert.equal(JSON.parse(db.prepare('SELECT value FROM payload_preferences').get().value).columns[1].active, false)
}))
