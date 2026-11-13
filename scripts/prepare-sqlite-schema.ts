import { DatabaseSync, backup } from 'node:sqlite'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'

const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"'
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function snapshot(db: DatabaseSync) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__new_%'").all().map(row => {
    const table = String(row.name)
    const columns = db.prepare(`PRAGMA table_info(${quote(table)})`).all().map(c => String(c.name))
    const read = () => db.prepare(`SELECT ${columns.map(quote).join(',')} FROM ${quote(table)} ORDER BY ${columns.includes('id') ? 'id' : columns.map(quote).join(',')}`).all()
    const indexes = db.prepare(`PRAGMA index_list(${quote(table)})`).all().filter(i => i.origin === 'c').map(i => ({ name: String(i.name), unique: i.unique, columns: db.prepare(`PRAGMA index_info(${quote(String(i.name))})`).all().map(c => c.name) }))
    return { table, columns, hash: hash(read()), read, indexes }
  })
}
function verify(db: DatabaseSync, originals: ReturnType<typeof snapshot>) {
  for (const original of originals) {
    const columns = db.prepare(`PRAGMA table_info(${quote(original.table)})`).all().map(c => String(c.name))
    if (original.columns.some(c => !columns.includes(c)) || hash(original.read()) !== original.hash)
      throw new Error(`La actualización alteró datos originales de ${original.table}; se revirtió.`)
    const indexes = db.prepare(`PRAGMA index_list(${quote(original.table)})`).all()
    for (const index of original.indexes) {
      const current = indexes.find(i => i.name === index.name)
      if (!current || current.unique !== index.unique || hash(db.prepare(`PRAGMA index_info(${quote(index.name)})`).all().map(c => c.name)) !== hash(index.columns))
        throw new Error(`La actualización alteró el índice ${index.name}; se revirtió.`)
    }
  }
  if (db.prepare('PRAGMA integrity_check').all().some(r => r.integrity_check !== 'ok') || db.prepare('PRAGMA foreign_key_check').all().length)
    throw new Error('El esquema no supera la comprobación de integridad; se revirtió.')
}

// Drizzle's SQLite table rebuild can copy newly added columns before adding them
// when nullability changes in the same release. Add nullable columns first.
export async function prepareLegacySqliteSchema(filename: string) {
  const db = new DatabaseSync(filename)
  try {
    const additions: Record<string, Record<string, string>> = {
      departures: { program_ref_id: 'integer', departure_key: 'text', available_seats: 'numeric', last_seats: 'integer DEFAULT 0', seats_checked_at: 'text', seats_confirmed: 'integer DEFAULT 0' },
      _departures_v: { version_program_ref_id: 'integer', version_departure_key: 'text', version_available_seats: 'numeric', version_last_seats: 'integer DEFAULT 0', version_seats_checked_at: 'text', version_seats_confirmed: 'integer DEFAULT 0' },
      banners: { placement: "text DEFAULT 'hero'", title: 'text', message: 'text', button_label: 'text', popup_kind: "text DEFAULT 'promotion'", popup_frequency: "text DEFAULT 'session'", popup_delay: 'numeric DEFAULT 2' },
      payload_locked_documents_rels: { programs_id: 'integer', seat_pilot_pools_id: 'integer', seat_pilot_reservations_id: 'integer', seat_mail_events_id: 'integer', mail_sync_cursors_id: 'integer' },
      audit_log: { entity_type: "text DEFAULT 'departure'", program_id: 'text' },
      settings: { seats_validity_hours: 'numeric DEFAULT 72 NOT NULL', featured_departure1_id: 'integer', featured_departure2_id: 'integer' },
      settings_blog_posts: { image_id: 'integer' },
    }
    const statements: string[] = []
    for (const [table, fields] of Object.entries(additions)) {
      const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map(row => String(row.name))
      if (!columns.length) continue
      for (const [column, type] of Object.entries(fields)) if (!columns.includes(column)) statements.push(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`)
    }
    const temporaryTables = ['__new_departures', '__new__departures_v', '__new_banners', '__new_payload_locked_documents_rels', '__new_audit_log', '__new_settings_blog_posts']
      .filter(table => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))
    if (!statements.length && !temporaryTables.length) return null
    await mkdir('backups', { recursive: true })
    const file = path.resolve('backups', 'antes-esquema-programas-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite.db')
    await backup(db, file)
    db.exec('BEGIN IMMEDIATE')
    try {
      // Only remove empty temporary tables left by an interrupted Drizzle rebuild.
      const originals = snapshot(db)
      for (const table of temporaryTables) {
          if (Number(db.prepare(`SELECT count(*) AS count FROM "${table}"`).get()!.count)) throw new Error(`La tabla temporal ${table} contiene datos; se necesita revisarla antes de migrar.`)
          db.exec(`DROP TABLE "${table}"`)
      }
      for (const sql of statements) db.exec(sql)
      for (const [table, column, index, unique] of [
        ['departures', 'program_ref_id', 'departures_program_ref_idx', false],
        ['departures', 'departure_key', 'departures_departure_key_idx', true],
        ['_departures_v', 'version_program_ref_id', '_departures_v_version_version_program_ref_idx', false],
        ['_departures_v', 'version_departure_key', '_departures_v_version_version_departure_key_idx', false],
        ['payload_locked_documents_rels', 'programs_id', 'payload_locked_documents_rels_programs_id_idx', false],
        ['payload_locked_documents_rels', 'seat_pilot_pools_id', 'payload_locked_documents_rels_seat_pilot_pools_id_idx', false],
        ['payload_locked_documents_rels', 'seat_pilot_reservations_id', 'payload_locked_documents_rels_seat_pilot_reservations_id_idx', false],
        ['payload_locked_documents_rels', 'seat_mail_events_id', 'payload_locked_documents_rels_seat_mail_events_id_idx', false],
        ['payload_locked_documents_rels', 'mail_sync_cursors_id', 'payload_locked_documents_rels_mail_sync_cursors_id_idx', false],
        ['audit_log', 'program_id', 'audit_log_program_id_idx', false],
        ['departures', 'seats_checked_at', 'departures_seats_checked_at_idx', false],
        ['_departures_v', 'version_seats_checked_at', '_departures_v_version_version_seats_checked_at_idx', false],
      ] as const) {
        if (db.prepare(`PRAGMA table_info("${table}")`).all().length) db.exec(`CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${index}" ON "${table}" ("${column}")`)
      }
      verify(db, originals)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return { backup: file, columnsAdded: statements.length }
  } finally { db.close() }
}

export async function applySqliteSchemaPlan(filename: string, statements: string[]) {
  if (!statements.length) return
  const db = new DatabaseSync(filename)
  try {
    await mkdir('backups', { recursive: true })
    const file = path.resolve('backups', 'antes-reconstruccion-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite.db')
    await backup(db, file)
    db.exec('PRAGMA foreign_keys=OFF')
    db.exec('BEGIN IMMEDIATE')
    try {
      const originals = snapshot(db)
      const indexes = new Set<string>()
      for (const sql of statements) {
        if (/^PRAGMA foreign_keys=/i.test(sql)) continue
        if (/^CREATE (UNIQUE )?INDEX /i.test(sql)) {
          if (indexes.has(sql)) continue // Drizzle 3.90 can emit rebuild indexes twice.
          indexes.add(sql)
        }
        db.exec(sql)
      }
      verify(db, originals)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    finally { db.exec('PRAGMA foreign_keys=ON') }
    return file
  } finally { db.close() }
}
