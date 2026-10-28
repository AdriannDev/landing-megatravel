import test from 'node:test'
import assert from 'node:assert/strict'
import { migrationGroups, departureKey, resolveProgram } from '../src/lib/programs.ts'
import { planImport } from '../src/lib/import-records.ts'
import { toPublicPackage } from '../src/lib/catalog.ts'
import { DEFAULT_FLYER } from '../src/lib/flyer.ts'
import { departureViewWhere, departureViewURL, parseDepartureView } from '../src/lib/admin-views.ts'
import { bannersAt } from '../src/lib/banners.ts'

const row = { source_key: '1', program: 'Europa', mtpe: ' mt01 ', destination: 'Madrid', zone: 'Europa', origin: 'Lima', days: '10', nights: '8', travel_date: '2029-05-10', price: '1000', booking_url: 'https://www.megatravel.pe/', description_url: 'https://cafe.megatravel.pe/', status: 'draft' }
test('CSV comparte un programa por MTPE y permite precios y fechas distintos', () => {
  const result = planImport([row, { ...row, source_key: '2', travel_date: '2029-06-10', price: '1500' }])
  assert.equal(result.errors.length, 0); assert.equal(result.accepted.length, 2)
  assert.equal(result.accepted[0].item.mtpe, 'MT01'); assert.equal(result.accepted[0].item.flyerUrl, '')
})
test('CSV rechaza todas las filas de un MTPE contradictorio y aísla otros programas', () => {
  for (const [field, value] of [['program', 'Otro'], ['days', '12'], ['flyer_url', 'https://example.com/arte.png'], ['booking_url', 'https://example.com/reserva']]) {
    const result = planImport([row, { ...row, source_key: '2', travel_date: '2029-06-10', [field]: value }, { ...row, source_key: '3', mtpe: 'MT02' }])
    assert.equal(result.accepted.length, 1, field); assert.equal(result.accepted[0].item.mtpe, 'MT02')
    assert.equal(result.errors.length, 2)
  }
})
test('CSV rechaza fechas repetidas para MTPE y origen aunque cambie source_key', () => {
  const result = planImport([row, { ...row, source_key: '2' }])
  assert.equal(result.errors.length, 1); assert.match(result.errors[0].error, /Fecha repetida/)
  assert.notEqual(departureKey(' MT01 ', 2, row.travel_date), departureKey('mt01', 3, row.travel_date))
})
test('una fila inválida o duplicada no oculta contradicciones de contenido del mismo MTPE', () => {
  const result = planImport([row, { ...row, program: 'Contradictorio', travel_date: 'no-es-fecha' }])
  assert.equal(result.accepted.length, 0); assert.equal(result.errors.length, 2)
})
test('migración elige publicada vigente antes que borrador más reciente y desempata por ID', () => {
  const base = { mtpe: 'MT01', travelDate: '2029-05-10', advanceDays: 30, updatedAt: '2026-01-01T00:00:00Z' }
  const docs = [{ ...base, id: 1, status: 'published' }, { ...base, id: 11, status: 'draft', updatedAt: '2026-10-10T00:00:00Z' }, { ...base, id: 10, status: 'published' }, { ...base, mtpe: 'MT02', id: 12, status: 'withdrawn' }]
  const groups = migrationGroups(docs, new Date('2026-10-28'))
  assert.equal(groups[0].source.id, 10); assert.equal(groups[1].source.id, 12)
  assert.deepEqual(groups[0].departures.map(d => d.id), [1, 11, 10])
  assert.equal(migrationGroups(docs, new Date('2030-01-01'))[0].source.id, 11)
})
test('contenido compartido reemplaza incluso un flyer vacío y conserva precio y origen', () => {
  const doc = resolveProgram({ program: 'Antiguo', flyerSourceUrl: 'https://example.com/old.png', price: 99, origin: 'Lima', programRef: { id: 1, program: 'Nuevo', mtpe: 'MT01', flyerSourceUrl: '' } })
  assert.equal(doc.program, 'Nuevo'); assert.equal(doc.flyerSourceUrl, '')
  assert.equal(doc.price, 99); assert.equal(doc.origin, 'Lima')
  assert.equal(toPublicPackage({ ...doc, id: '1', promotions: [] }).flyerUrl, DEFAULT_FLYER)
})
test('vistas usan vigencia con corte exclusivo y URL conserva la vista', () => {
  const now = new Date('2026-10-28T05:00:00Z')
  assert.equal(departureViewWhere('published', now).and[1].withdrawalAt.greater_than, now.toISOString())
  assert.equal(departureViewWhere('expiring', now).and[2].withdrawalAt.less_than_equal, '2026-11-04T05:00:00.000Z')
  assert.equal(departureViewWhere('withdrawn', now).or[1].and[1].withdrawalAt.less_than_equal, now.toISOString())
  assert.equal(new URL(departureViewURL('draft', now), 'http://localhost').searchParams.get('mtView'), 'draft')
  assert.equal(parseDepartureView('invalid'), 'published')
})
test('banners vacíos, heredados, orden y vigencia respetan la ubicación', () => {
  const now = new Date('2026-10-28T05:00:00Z')
  assert.deepEqual(bannersAt([], 'hero', now), [])
  const banners = [{ id: '1', order: 5 }, { id: '2', placement: 'hero', order: 1 }, { id: '3', placement: 'catalog-end' }, { id: '4', placement: 'between-results' }, { id: '5', placement: 'hero', endsAt: now.toISOString() }, { id: '6', startsAt: '2027-01-01T00:00:00Z' }]
  assert.deepEqual(bannersAt(banners, 'hero', now).map(b => b.id), ['2', '1'])
  assert.deepEqual(bannersAt(banners, 'catalog-end', now).map(b => b.id), ['3'])
  assert.deepEqual(bannersAt(banners, 'between-results', now).map(b => b.id), ['4'])
})
