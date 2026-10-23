import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyFilters, parseFilters, serializeFilters, filterCatalog, publishedPackages, toPublicPackage } from '../src/lib/catalog.ts'
const base = { id: '1', program: 'Magia Europea', mtpe: '10045', destination: 'Madrid', zone: 'Europa', origin: 'Lima', days: 18, travelDate: '2027-03-12', price: 3999, currency: 'USD', priceCondition: 'Por persona', flyerUrl: 'https://img.example/a.jpg', bookingUrl: 'https://example.com/book', descriptionUrl: 'https://example.com/pdf', promotions: [{ id: 'santa', label: 'Semana Santa', name: 'Semana Santa' }], priority: 0, status: 'published', advanceDays: 30, withdrawalReason: 'request', withdrawalNote: 'Dato privado', retiredBy: 'user1', sourceSheet: 'Hoja privada' }
const items = [base, { ...base, id: '2', program: 'Japón Imperial', destination: 'Tokio', zone: 'Asia', mtpe: '30010', origin: 'Arequipa', travelDate: '2027-04-12', price: 4999, promotions: [], days: 12 }, { ...base, id: '3', program: 'China', destination: 'Beijing', zone: 'Asia', mtpe: '30062', travelDate: '2027-03-12', price: 4499, days: 14 }]
test('búsqueda por código, destino y texto con acentos', () => {
  for (const [q, expected] of [['10045', '1'], ['tokio', '2'], ['japon', '2'], ['MTPE-30062', '3']]) assert.equal(filterCatalog(items, { ...emptyFilters(), q }).items[0].id, expected)
})
test('OR dentro del filtro y AND entre filtros', () => {
  const result = filterCatalog(items, { ...emptyFilters(), zones: ['Europa', 'Asia'], origins: ['Lima'], promotions: ['santa'], from: '2027-03-12', to: '2027-03-12' })
  assert.deepEqual(result.items.map(i => i.id), ['1', '3'])
})
test('meses, programa, naviera y promoción se combinan', () => {
  assert.equal(filterCatalog(items, { ...emptyFilters(), months: ['2027-04'], programs: ['Japón Imperial'] }).total, 1)
  assert.equal(filterCatalog(items, { ...emptyFilters(), cruiseLines: ['MSC'] }).total, 0)
})
test('una URL reproduce filtros, orden y página', () => {
  const filters = { ...emptyFilters(), q: 'Madrid & Europa', zones: ['Europa', 'Asia'], months: ['2027-03'], destinations: ['Madrid'], promotions: ['santa'], from: '2027-03-01', to: '2027-03-31', sort: 'price-asc', page: 2 }
  assert.deepEqual(parseFilters(new URLSearchParams(serializeFilters(filters))), filters)
})
test('parámetros inválidos y páginas fuera de rango se normalizan', () => {
  const f = parseFilters(new URLSearchParams('page=-1&from=2026-02-29&months=2027-99&sort=unknown'))
  assert.equal(f.page, 1); assert.equal(f.from, ''); assert.deepEqual(f.months, []); assert.equal(f.sort, 'featured')
  assert.equal(filterCatalog(items, { ...emptyFilters(), page: 999 }).page, 1)
})
test('paginación de doce y orden estable', () => {
  const data = Array.from({ length: 26 }, (_, i) => ({ ...base, id: String(i).padStart(2, '0') }))
  const result = filterCatalog(data, { ...emptyFilters(), page: 3 })
  assert.equal(result.total, 26); assert.equal(result.pages, 3); assert.equal(result.items.length, 2)
})
test('orden por precio, fecha, duración y destacados', () => {
  assert.equal(filterCatalog(items, { ...emptyFilters(), sort: 'price-desc' }).items[0].id, '2')
  assert.equal(filterCatalog(items, { ...emptyFilters(), sort: 'duration' }).items[0].id, '2')
  assert.equal(filterCatalog(items.map(i => ({ ...i, priority: i.id === '3' ? 5 : 0 })), emptyFilters()).items[0].id, '3')
})
test('API pública proyecta solo campos comerciales', () => {
  const output = toPublicPackage(base, new Date('2026-10-23'))
  for (const key of ['withdrawalReason', 'withdrawalNote', 'retiredBy', 'sourceSheet', 'advanceDays', 'status']) assert.equal(key in output, false)
  assert.equal(publishedPackages([base, { ...base, id: 'draft', status: 'draft' }, { ...base, id: 'retired', status: 'withdrawn' }], new Date('2026-10-23')).length, 1)
})
