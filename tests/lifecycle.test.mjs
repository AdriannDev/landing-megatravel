import test from 'node:test'
import assert from 'node:assert/strict'
import { retirementAt, isPublishable, validateTransition, validatePublication, safeExternalUrl, isActivePeriod } from '../src/lib/lifecycle.ts'
const item = { id: 'a', program: 'Europa', mtpe: '10035', destination: 'Madrid', zone: 'Europa', origin: 'Lima', days: 17, nights: 15, travelDate: '2027-01-15', price: 3599, currency: 'USD', priceCondition: 'Por persona en habitación doble', flyerUrl: 'https://i.imgur.com/a.png', bookingUrl: 'https://www.megatravel.pe/es/idea/1', descriptionUrl: 'https://cafe.megatravel.pe/app/expreso?mt=10035', promotions: [], priority: 0, status: 'published', advanceDays: 30 }
const now = new Date('2026-10-23T17:00:00Z')
test('retiro a medianoche de Lima con 30 días y cambio de año', () => assert.equal(retirementAt('2027-01-15', 30), '2026-12-16T05:00:00.000Z'))
test('retiro de 15 días cruza de mes', () => assert.equal(retirementAt('2027-03-05', 15), '2027-02-18T05:00:00.000Z'))
test('año bisiesto, excepción cero y plazo arbitrario', () => {
  assert.equal(retirementAt('2028-03-01', 1), '2028-02-29T05:00:00.000Z')
  assert.equal(retirementAt('2026-12-01', 0), '2026-12-01T05:00:00.000Z')
  assert.equal(retirementAt('2027-01-02', 7), '2026-12-26T05:00:00.000Z')
})
test('rechaza fechas inexistentes y plazos negativos o fraccionarios', () => {
  for (const date of ['2026-02-29', '2026-13-01', '2026-1-02', 'texto']) assert.throws(() => retirementAt(date))
  for (const days of [-1, 1.5, Infinity, NaN, 3651]) assert.throws(() => retirementAt('2027-01-01', days))
})
test('consulta pública corta incluso si el cron no se ejecutó', () => {
  assert.ok(isPublishable(item, new Date('2026-12-16T04:59:59.999Z')))
  assert.equal(isPublishable(item, new Date('2026-12-16T05:00:00Z')), false)
  assert.equal(isPublishable({ ...item, status: 'draft' }, now), false)
  assert.equal(isPublishable({ ...item, status: 'withdrawn' }, now), false)
})
test('retiro manual exige motivo y explicación de otro', () => {
  assert.ok(validateTransition(item, { ...item, status: 'withdrawn' }, { now }).length)
  assert.ok(validateTransition(item, { ...item, status: 'withdrawn', withdrawalReason: 'other' }, { now }).length)
  assert.deepEqual(validateTransition(item, { ...item, status: 'withdrawn', withdrawalReason: 'other', withdrawalNote: 'Solicitud comercial' }, { now }), [])
})
test('solo el sistema puede declarar retiro automático', () => {
  const next = { ...item, status: 'withdrawn', withdrawalReason: 'automatic' }
  assert.ok(validateTransition(item, next, { now }).length)
  assert.deepEqual(validateTransition(item, next, { now, automatic: true }), [])
})
test('reactivación requiere revisar datos y conservar vigencia', () => {
  const previous = { ...item, status: 'withdrawn' }
  assert.ok(validateTransition(previous, item, { now }).length)
  assert.deepEqual(validateTransition(previous, item, { now, reviewConfirmed: true }), [])
  assert.ok(validateTransition(previous, item, { now: new Date('2026-12-17'), reviewConfirmed: true }).length)
})
test('pasar por borrador no permite eludir retiro o reactivación', () => {
  assert.ok(validateTransition(item, { ...item, status: 'draft' }, { now }).length)
  assert.ok(validateTransition({ ...item, status: 'withdrawn' }, { ...item, status: 'draft' }, { now }).length)
})
test('publicación exige precio, enlaces HTTPS, moneda y flyer', () => {
  assert.deepEqual(validatePublication(item, now), [])
  assert.ok(validatePublication({ ...item, price: 0, bookingUrl: 'javascript:alert(1)', flyerUrl: '', currency: '???' }, now).length >= 4)
  assert.equal(safeExternalUrl('https://user:password@example.com'), false)
  assert.equal(safeExternalUrl('http://example.com'), false)
})
test('periodo de campaña tiene fin exclusivo', () => {
  const period = { startsAt: '2026-10-01T05:00:00Z', endsAt: '2026-11-01T05:00:00Z' }
  assert.ok(isActivePeriod(period, now)); assert.equal(isActivePeriod(period, new Date(period.endsAt)), false)
})
