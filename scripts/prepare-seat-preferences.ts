import { DatabaseSync, backup } from 'node:sqlite'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { departureSeatColumns } from '../src/lib/seat-columns.ts'

export async function prepareSeatPreferences(filename: string) {
  const db = new DatabaseSync(filename)
  try {
    if (!db.prepare("SELECT name FROM sqlite_master WHERE name='payload_preferences'").get()) return 0
    const changes = db.prepare("SELECT id,value FROM payload_preferences WHERE key='collection-departures'").all().flatMap(row => {
      const value = typeof row.value === 'string' ? JSON.parse(row.value) : null
      if (!Array.isArray(value?.columns) || value?.seatColumnsVersion === 1) return []
      return [{ id: row.id, value: JSON.stringify({ ...value, columns: departureSeatColumns(value.columns), seatColumnsVersion: 1 }) }]
    })
    if (!changes.length) return 0
    await mkdir('backups', { recursive: true })
    await backup(db, path.resolve('backups', `antes-columnas-cupos-${Date.now()}.sqlite.db`))
    db.exec('BEGIN IMMEDIATE')
    try {
      for (const change of changes) db.prepare('UPDATE payload_preferences SET value=? WHERE id=?').run(change.value, change.id)
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return changes.length
  } finally { db.close() }
}
