import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseCSV, serializeCSV, parseSourceDate, parsePrice } from '../src/lib/csv.ts'
import { planImport } from '../src/lib/import-records.ts'
import { readWorkbook } from '../scripts/read-xlsx.mjs'
const row = { source_key: 'id-1', program: 'Europa', mtpe: '10035', destination: 'Madrid', zone: 'Europa', origin: 'Lima', travel_date: '2027-05-10', days: '17', price: '3,599.00', currency: 'USD', price_condition: 'Por persona', flyer_url: 'https://i.imgur.com/a.png', booking_url: 'https://www.megatravel.pe/es/idea/1', description_url: 'https://cafe.megatravel.pe/app/expreso?mt=10035', status: 'published', advance_days: '15' }
test('CSV admite comas, comillas, BOM, CRLF y saltos dentro de campos', () => {
  const parsed = parseCSV('\uFEFFa,b\r\n"Programa, especial","Texto ""citado""\nsegunda línea"\r\n')
  assert.deepEqual(parsed, [{ a: 'Programa, especial', b: 'Texto "citado"\nsegunda línea' }])
  assert.deepEqual(parseCSV('a;b\n1;2'), [{ a: '1', b: '2' }])
})
test('CSV rechaza comillas incompletas, columnas y encabezados repetidos', () => {
  assert.throws(() => parseCSV('a,b\n"sin cerrar,2'))
  assert.throws(() => parseCSV('a,b\n1,2,3'))
  assert.throws(() => parseCSV('a,a\n1,2'))
})
test('exportación protege Excel contra fórmulas y preserva texto citado', () => {
  const csv = serializeCSV([{ a: '=HYPERLINK("x")', b: 'Texto, ejemplo' }], ['a', 'b'])
  const parsed = parseCSV(csv); assert.ok(parsed[0].a.startsWith("'=")); assert.equal(parsed[0].b, 'Texto, ejemplo')
})
test('normaliza fechas ISO, peruanas y seriales de Excel sin inventar año', () => {
  assert.equal(parseSourceDate('10/05/2027'), '2027-05-10')
  assert.equal(parseSourceDate('46350.0'), '2026-11-24')
  assert.equal(parseSourceDate('46252.60009810185'), '2026-08-18')
  assert.throws(() => parseSourceDate('10/05'))
})
test('normaliza precios con separadores peruanos e internacionales', () => {
  for (const value of ['US$ 1,299.00', '1.299,00', '1299,00', '1299.0']) assert.equal(parsePrice(value), 1299)
  assert.throws(() => parsePrice('gratis')); assert.throws(() => parsePrice(''))
})
test('plan de importación detecta duplicados y reporta filas inválidas', () => {
  const plan = planImport([row, row, { ...row, source_key: 'id-2', travel_date: '2027-02-30' }], { now: new Date('2026-10-23') })
  assert.equal(plan.accepted.length, 1); assert.equal(plan.errors.length, 2)
  assert.equal(plan.errors[0].row, 3)
})
test('la clave permanece estable en importaciones repetidas', () => {
  const first = planImport([row], { now: new Date('2026-10-23') }).accepted[0].item
  const second = planImport([{ ...row, price: '3799' }], { now: new Date('2026-10-23') }).accepted[0].item
  assert.equal(first.sourceKey, second.sourceKey); assert.equal(second.price, 3799)
})
test('importación histórica conserva retiros sin inventar motivo', () => {
  const plan = planImport([{ ...row, status: 'withdrawn', withdrawal_reason: '', travel_date: '2026-07-01' }], { historical: true })
  assert.equal(plan.accepted.length, 1); assert.equal(plan.accepted[0].item.withdrawalReason, null)
})
test('el Excel original y el mapeo conservan hojas, fechas y enlaces', async t => {
  try { await readFile('Bloqueos aereos (1).xlsx') } catch { t.skip('Archivo de origen no incluido en esta copia del proyecto.'); return }
  const sheets = await readWorkbook('Bloqueos aereos (1).xlsx')
  assert.equal(sheets.length, 6)
  assert.equal(sheets[0].rows[1].cells.I.hyperlink.includes('megatravel.pe'), true)
  const records = JSON.parse(await readFile('migration/departures.json', 'utf8'))
  assert.equal(records.length, 411)
  assert.equal(records.filter(r => r.status === 'draft').length, 10)
  assert.equal(records.filter(r => r.sourceSheet.startsWith('BACKUP')).length, 0)
  const historical = records.find(r => r.sourceRetirementRaw)
  assert.ok(historical.sourceRetirementDate); assert.equal(historical.retiredAt, null)
})
