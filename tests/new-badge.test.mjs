import test from 'node:test'
import assert from 'node:assert/strict'
import { publicNewBadge, programBadgeSnapshot, DEFAULT_NEW_BADGE_LABEL } from '../src/lib/new-badge.ts'
import { resolveProgram } from '../src/lib/programs.ts'
import { toPublicPackage } from '../src/lib/catalog.ts'

const now = Date.parse('2027-01-10T12:00:00.000Z')
const program = { id: 7, newBadge: true, newBadgeLabel: 'Nuevo programa', newBadgeUntil: null }

test('la etiqueta del programa se aplica a todas sus fechas', () => {
  const dates = [{ programRef: program, newBadge: false }, { programRef: program }].map(resolveProgram)
  for (const date of dates) assert.deepEqual(publicNewBadge(date, now), { label: 'Nuevo programa' })
})

test('la fecha individual se suma y su texto tiene prioridad', () => {
  const off = { ...program, newBadge: false }
  assert.equal(publicNewBadge(resolveProgram({ programRef: off }), now), null)
  assert.deepEqual(publicNewBadge(resolveProgram({ programRef: off, newBadge: true, newBadgeLabel: 'NUEVA FECHA' }), now), { label: 'NUEVA FECHA' })
  assert.deepEqual(publicNewBadge(resolveProgram({ programRef: program, newBadge: true, newBadgeLabel: 'NUEVA FECHA' }), now), { label: 'NUEVA FECHA' })
  // Sin texto propio, la fecha usa el texto del programa.
  assert.deepEqual(publicNewBadge(resolveProgram({ programRef: off, newBadge: true }), now), { label: 'Nuevo programa' })
})

test('«Mostrar hasta» vencido oculta la etiqueta y el límite es exclusivo', () => {
  const at = new Date(now).toISOString()
  assert.equal(publicNewBadge({ newBadge: true, newBadgeUntil: at }, now), null)
  assert.ok(publicNewBadge({ newBadge: true, newBadgeUntil: new Date(now + 1).toISOString() }, now))
  assert.equal(publicNewBadge({ programNewBadge: true, programNewBadgeUntil: new Date(now - 1).toISOString() }, now), null)
  // Una fecha vencida no oculta la etiqueta vigente del programa.
  assert.deepEqual(publicNewBadge({ newBadge: true, newBadgeLabel: 'NUEVA FECHA', newBadgeUntil: at, programNewBadge: true }, now), { label: DEFAULT_NEW_BADGE_LABEL })
})

test('texto vacío usa NUEVO y se limita a 24 caracteres', () => {
  assert.deepEqual(publicNewBadge({ newBadge: true, newBadgeLabel: '   ' }, now), { label: 'NUEVO' })
  assert.equal(publicNewBadge({ newBadge: true, newBadgeLabel: 'x'.repeat(40) }, now).label.length, 24)
  assert.equal(publicNewBadge({}, now), null)
  assert.deepEqual(programBadgeSnapshot({}), { programNewBadge: false, programNewBadgeLabel: null, programNewBadgeUntil: null })
})

test('el catálogo público solo expone el texto de la etiqueta', () => {
  const base = { id: '1', program: 'Magia Europea', mtpe: '10045', destination: 'Madrid', zone: 'Europa', origin: 'Lima', days: 18, nights: 17, travelDate: '2027-03-12', price: 3999, currency: 'USD', priceCondition: 'Por persona', flyerUrl: 'https://img.example/a.jpg', bookingUrl: 'https://example.com/book', descriptionUrl: 'https://example.com/pdf', promotions: [], priority: 0, status: 'published', advanceDays: 30, withdrawalAt: '2027-02-10T05:00:00.000Z' }
  const item = toPublicPackage({ ...base, newBadge: true, newBadgeLabel: 'NUEVA FECHA', newBadgeUntil: '2027-02-01T05:00:00.000Z', programNewBadge: true }, new Date(now))
  assert.deepEqual(item.newBadge, { label: 'NUEVA FECHA' })
  for (const key of ['newBadgeLabel', 'newBadgeUntil', 'programNewBadge', 'programNewBadgeLabel', 'programNewBadgeUntil']) assert.equal(key in item, false)
  assert.equal(toPublicPackage(base, new Date(now)).newBadge, null)
})
