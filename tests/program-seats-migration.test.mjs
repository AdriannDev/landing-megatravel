import test from 'node:test'
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { migrateProgramSeatsSqlite } from '../scripts/migrate-program-seats-sqlite.ts'

test('migrar cupos conserva conflictos e indicadores, genera respaldo y no sobrescribe saldos revisados', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'program-seats-')), filename = path.join(dir, 'test.db')
  let backupFile
  const db = new DatabaseSync(filename)
  db.exec(`CREATE TABLE programs(id INTEGER PRIMARY KEY,flyer_download_warning TEXT);
    CREATE TABLE departures(id INTEGER PRIMARY KEY,program_ref_id INTEGER,origin_id INTEGER,travel_date TEXT,available_seats NUMERIC,last_seats INTEGER,seats_checked_at TEXT,flyer_download_warning TEXT);
    CREATE TABLE _programs_v(id INTEGER PRIMARY KEY,version_flyer_download_warning TEXT);
    CREATE TABLE _departures_v(id INTEGER PRIMARY KEY,version_last_seats INTEGER,version_seats_checked_at TEXT,version_flyer_download_warning TEXT);
    INSERT INTO programs(id) VALUES (1),(2);
    INSERT INTO departures VALUES (1,1,1,'2030-01-01',15,1,'2026-11-01T10:00:00.000Z',null),(2,1,1,'2030-02-01',15,0,'2026-11-01T11:00:00.000Z',null),(3,2,1,'2030-01-01',7,0,null,null),(4,2,1,'2030-02-01',3,1,'2026-11-01T10:00:00.000Z',null);`)
  db.close()
  try {
    assert.deepEqual(await migrateProgramSeatsSqlite(filename), { programs: 2, conflicts: 1, applied: false })
    const applied = await migrateProgramSeatsSqlite(filename, true)
    backupFile = applied.backup
    assert.equal(applied.conflicts, 1)
    const migrated = new DatabaseSync(filename)
    try {
      const rows = migrated.prepare('SELECT * FROM programs ORDER BY id').all()
      assert.equal(rows[0].available_seats, 15)
      assert.equal(rows[1].available_seats, null); assert.equal(rows[1].seats_migration_pending, 1)
      assert.deepEqual(JSON.parse(rows[1].legacy_seat_references).map(d => d.availableSeats), [7, 3])
      const date = migrated.prepare('SELECT * FROM departures WHERE id=1').get()
      assert.equal(date.last_seats, 1); assert.equal(date.last_seats_checked_at, '2026-11-01T10:00:00.000Z')
      assert.equal('flyer_download_warning' in date, false)
      migrated.exec('UPDATE programs SET available_seats=12 WHERE id=1')
    } finally { migrated.close() }
    assert.equal((await migrateProgramSeatsSqlite(filename)).programs, 0)
    const before = new DatabaseSync(backupFile, { readOnly: true })
    try { assert.deepEqual(before.prepare('SELECT available_seats FROM departures WHERE program_ref_id=2 ORDER BY id').all().map(d => d.available_seats), [7, 3]) } finally { before.close() }
  } finally { await rm(dir, { recursive: true, force: true }); if (backupFile) await rm(backupFile) }
})
