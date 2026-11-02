import { DatabaseSync, backup } from 'node:sqlite'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

// Run before starting the updated development server. PostgreSQL uses Payload migrations.
export async function migrateProgramSeatsSqlite(filename: string, apply = false) {
  const db = new DatabaseSync(filename)
  const columns = (table: string) => db.prepare(`PRAGMA table_info("${table}")`).all().map(row => String(row.name))
  try {
    if (!columns('programs').length || !columns('departures').includes('program_ref_id')) throw new Error('Primero debe estar instalada la estructura de Programas.')
    const pColumns = columns('programs')
    const programs = db.prepare('SELECT * FROM programs ORDER BY id').all()
    const initialState = JSON.stringify({ programs, departures: db.prepare('SELECT * FROM departures ORDER BY id').all() })
    const plans = programs.filter(p => p.legacy_seat_references == null && (!pColumns.includes('available_seats') || p.available_seats == null && !p.last_seats && !p.seats_checked_at)).map(program => {
      const dates = db.prepare('SELECT id,origin_id,travel_date,available_seats,last_seats,seats_checked_at FROM departures WHERE program_ref_id=? ORDER BY id').all(program.id)
      const quantities = [...new Set(dates.filter(d => d.available_seats != null).map(d => Number(d.available_seats)))]
      const pending = quantities.length > 1 || quantities.some(n => !Number.isSafeInteger(n) || n < 0)
      const checked = dates.filter(d => d.available_seats != null).map(d => d.seats_checked_at ? String(d.seats_checked_at) : '')
      return { id: program.id, availableSeats: !pending && quantities.length === 1 ? quantities[0] : null, checkedAt: checked.length && checked.every(Boolean) ? checked.sort()[0] : null, pending, dates }
    })
    if (!apply) return { programs: plans.length, conflicts: plans.filter(p => p.pending).length, applied: false }
    await mkdir('backups', { recursive: true })
    const backupFile = path.resolve('backups', `antes-cupos-compartidos-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite.db`)
    await backup(db, backupFile)
    db.exec('BEGIN IMMEDIATE')
    try {
      const lockedState = JSON.stringify({ programs: db.prepare('SELECT * FROM programs ORDER BY id').all(), departures: db.prepare('SELECT * FROM departures ORDER BY id').all() })
      if (lockedState !== initialState) throw new Error('Los datos cambiaron mientras se preparaba el respaldo. Vuelve a ejecutar la migración.')
      const additions: Record<string, Record<string, string>> = {
        programs: { available_seats: 'numeric', last_seats: 'integer DEFAULT 0', seats_checked_at: 'text', seats_confirmed: 'integer DEFAULT 0', seats_migration_pending: 'integer DEFAULT 0', legacy_seat_references: 'text' },
        _programs_v: { version_available_seats: 'numeric', version_last_seats: 'integer DEFAULT 0', version_seats_checked_at: 'text', version_seats_confirmed: 'integer DEFAULT 0', version_seats_migration_pending: 'integer DEFAULT 0', version_legacy_seat_references: 'text' },
        departures: { program_last_seats: 'integer DEFAULT 0', last_seats_checked_at: 'text' },
        _departures_v: { version_program_last_seats: 'integer DEFAULT 0', version_last_seats_checked_at: 'text' },
      }
      const hadLocalStamp = columns('departures').includes('last_seats_checked_at')
      for (const [table, fields] of Object.entries(additions)) for (const [name, type] of Object.entries(fields)) {
        if (!columns(table).includes(name)) db.exec(`ALTER TABLE "${table}" ADD COLUMN "${name}" ${type}`)
      }
      if (!hadLocalStamp) {
        db.exec('UPDATE departures SET last_seats_checked_at=seats_checked_at WHERE last_seats=1')
        db.exec('UPDATE _departures_v SET version_last_seats_checked_at=version_seats_checked_at WHERE version_last_seats=1')
      }
      for (const plan of plans) {
        const legacy = plan.dates.map(d => ({ departureId: d.id, availableSeats: d.available_seats, lastSeats: !!d.last_seats, seatsCheckedAt: d.seats_checked_at, originId: d.origin_id, travelDate: d.travel_date }))
        db.prepare('UPDATE programs SET available_seats=?,seats_checked_at=?,seats_migration_pending=?,legacy_seat_references=? WHERE id=?').run(plan.availableSeats, plan.availableSeats == null ? null : plan.checkedAt, Number(plan.pending), JSON.stringify(legacy), plan.id)
        // Preserve local flags even when Drizzle already added the new column before this migration.
        for (const date of plan.dates) if (date.last_seats) db.prepare('UPDATE departures SET last_seats_checked_at=coalesce(last_seats_checked_at,?) WHERE id=?').run(date.seats_checked_at, date.id)
      }
      db.exec('UPDATE departures SET available_seats=(SELECT available_seats FROM programs WHERE programs.id=departures.program_ref_id),seats_checked_at=(SELECT seats_checked_at FROM programs WHERE programs.id=departures.program_ref_id),program_last_seats=(SELECT last_seats FROM programs WHERE programs.id=departures.program_ref_id) WHERE program_ref_id IS NOT NULL')
      db.exec('CREATE INDEX IF NOT EXISTS programs_seats_checked_at_idx ON programs(seats_checked_at)')
      db.exec('CREATE INDEX IF NOT EXISTS _programs_v_version_version_seats_checked_at_idx ON _programs_v(version_seats_checked_at)')
      for (const [table, column] of [['programs','flyer_download_warning'], ['departures','flyer_download_warning'], ['_programs_v','version_flyer_download_warning'], ['_departures_v','version_flyer_download_warning']]) {
        if (columns(table).includes(column)) db.exec(`ALTER TABLE "${table}" DROP COLUMN "${column}"`)
      }
      db.exec('COMMIT')
      return { programs: plans.length, conflicts: plans.filter(p => p.pending).length, applied: true, backup: backupFile }
    } catch (error) { db.exec('ROLLBACK'); throw error }
  } finally { db.close() }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/migrate-program-seats-sqlite.ts')) {
  if (process.env.USE_SQLITE !== 'true' || !process.env.SQLITE_URL?.startsWith('file:')) throw new Error('Este comando requiere USE_SQLITE=true y SQLITE_URL=file:... de desarrollo local.')
  console.log(JSON.stringify(await migrateProgramSeatsSqlite(path.resolve(process.env.SQLITE_URL.slice(5)), process.argv.includes('--apply'))))
}
