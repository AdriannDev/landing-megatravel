import { readWorkbook } from './read-xlsx.mjs'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parseSourceDate, parsePrice, serializeCSV } from '../src/lib/csv.ts'
import { retirementAt, safeExternalUrl } from '../src/lib/lifecycle.ts'
import { publishedPackages } from '../src/lib/catalog.ts'

const file = process.argv.find(a => a.endsWith('.xlsx')) || 'Bloqueos aereos (1).xlsx'
const sheets = await readWorkbook(file)
const report = { workbook: file, generatedAt: new Date().toISOString(), assumptions: { currency: 'USD', priceCondition: 'Por persona en habitación doble', confirmedByUser: true, defaultAdvanceDays: 30 }, sheets: [], errors: [], warnings: [], duplicates: [], assets: [] }
const records = [], seen = new Map(), assets = new Set()
for (const sheet of sheets) {
  const backup = sheet.name.startsWith('BACKUP')
  let accepted = 0, skipped = 0
  for (const row of sheet.rows.slice(1)) {
    const v = col => String(row.cells[col]?.value || '').trim()
    const link = col => row.cells[col]?.hyperlink || v(col)
    if (!v('C') && !v('B')) continue
    try {
      if (backup) { skipped++; continue }
      const mtpe = v('B').replace(/\.0+$/, '')
      if (!/^\d{4,6}$/.test(mtpe)) throw new Error('Código MTPE no válido; revisar si es un banner u otro contenido.')
      const travelDate = parseSourceDate(v('E'))
      const duration = /^(\d+)\s*D\s*\/\s*(\d+)\s*N$/i.exec(v('D'))
      if (!duration) throw new Error('Duración no reconocida: ' + v('D'))
      if (!v('H') || !v('G') || !v('F')) throw new Error('Faltan destino, origen o zona.')
      const price = parsePrice(v('K'))
      const issues = []
      if (!safeExternalUrl(link('I')) || !safeExternalUrl(link('J'))) issues.push('Enlaces de reserva/descriptivo incompletos o no HTTPS.')
      const flyerUrl = link('L')
      if (!safeExternalUrl(flyerUrl)) issues.push('Falta un enlace HTTPS de flyer.')
      const sourceKey = `xlsx:${mtpe}:${travelDate}:${v('G')}:${v('H')}`
      const existing = seen.get(sourceKey)
      if (existing) {
        report.duplicates.push({ sheet: sheet.name, row: row.number, sourceKey, kept: existing.sourceSheet + ':' + existing.sourceRef })
        continue
      }
      const advanceDays = v('R') ? Number(v('R')) : 30
      const withdrawalAt = retirementAt(travelDate, advanceDays)
      const historical = sheet.name !== sheets[0].name
      const promotions = v('O') ? [{ id: v('O').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: v('O'), label: v('O') }] : []
      const record = { id: createHash('sha256').update(sourceKey).digest('hex').slice(0, 20), sourceKey, sourceSheet: sheet.name, sourceRef: String(row.number), program: v('C'), mtpe, days: Number(duration[1]), nights: Number(duration[2]), travelDate, zone: v('F'), origin: v('G'), destination: v('H'), bookingUrl: link('I'), descriptionUrl: link('J'), price, currency: 'USD', priceCondition: report.assumptions.priceCondition, flyerUrl, cruiseLine: v('N') || null, promotions, priority: 0, advanceDays, withdrawalAt, status: historical ? 'withdrawn' : issues.length ? 'draft' : 'published', withdrawalReason: sheet.name === 'SOLD OUT' ? 'sold-out' : v('T').includes('automático') ? 'automatic' : v('T').includes('solicitud') ? 'request' : null, withdrawalNote: v('T') || null, retiredAt: null, sourceRetirementDate: v('S') ? parseSourceDate(v('S')) : null, sourceRetirementRaw: v('S') || null }
      if (issues.length) report.errors.push({ sheet: sheet.name, row: row.number, program: v('C'), message: issues.join(' '), importedAs: record.status })
      if (historical && !record.withdrawalReason) report.warnings.push({ sheet: sheet.name, row: row.number, message: 'Sin motivo histórico disponible. Se conserva vacío.' })
      records.push(record); seen.set(sourceKey, record); if (safeExternalUrl(flyerUrl)) assets.add(flyerUrl); accepted++
    } catch (error) { report.errors.push({ sheet: sheet.name, row: row.number, program: v('C'), message: error.message }) }
  }
  report.sheets.push({ name: sheet.name, accepted, skipped, backupExcluded: backup })
}
await mkdir('migration', { recursive: true }); await mkdir('src/data', { recursive: true })
await writeFile('migration/raw-workbook.json', JSON.stringify(sheets))
let manifest = {}
try { manifest = JSON.parse(await readFile('migration/assets.json', 'utf8')) } catch {}
const publicRecords = records.filter(r => r.status === 'published').map(r => ({ ...r, flyerUrl: manifest[r.flyerUrl]?.localUrl || r.flyerUrl }))
await writeFile('migration/departures.json', JSON.stringify(records, null, 2))
await writeFile('migration/asset-urls.json', JSON.stringify([...assets], null, 2))
try {
  const previousDownload = JSON.parse(await readFile('migration/download-report.json', 'utf8'))
  await writeFile('migration/download-report.json', JSON.stringify({ ...previousDownload, pending: [...assets].filter(url => !manifest[url]?.localUrl), sourceRefreshedAt: report.generatedAt }, null, 2))
} catch {}
await writeFile('src/data/catalog.json', JSON.stringify({ preparedAt: report.generatedAt, packages: publicRecords }, null, 2))
const headers = ['source_key', 'source_sheet', 'source_ref', 'program', 'mtpe', 'destination', 'zone', 'origin', 'days', 'nights', 'travel_date', 'price', 'currency', 'price_condition', 'flyer_url', 'booking_url', 'description_url', 'promotions', 'cruise_line', 'advance_days', 'status', 'withdrawal_reason', 'withdrawal_note', 'retired_at', 'source_retirement_date', 'source_retirement_raw']
await writeFile('migration/departures.csv', serializeCSV(records.map(r => ({ source_key: r.sourceKey, source_sheet: r.sourceSheet, source_ref: r.sourceRef, program: r.program, mtpe: r.mtpe, destination: r.destination, zone: r.zone, origin: r.origin, days: r.days, nights: r.nights, travel_date: r.travelDate, price: r.price, currency: r.currency, price_condition: r.priceCondition, flyer_url: r.flyerUrl, booking_url: r.bookingUrl, description_url: r.descriptionUrl, promotions: r.promotions.map(p => p.name).join('|'), cruise_line: r.cruiseLine, advance_days: r.advanceDays, status: r.status, withdrawal_reason: r.withdrawalReason, withdrawal_note: r.withdrawalNote, retired_at: r.retiredAt, source_retirement_date: r.sourceRetirementDate, source_retirement_raw: r.sourceRetirementRaw })), headers))
report.assets = [...assets]; report.summary = { total: records.length, publicNow: publishedPackages(records).length, errors: report.errors.length, duplicates: report.duplicates.length, images: assets.size }
await writeFile('migration/workbook-report.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({ ...report.summary, sheets: report.sheets, issues: report.errors.slice(0, 12) }, null, 2))
