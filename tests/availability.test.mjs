import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareSeatReference, publicAvailability, visibleAvailability, seatReviewState, seatsValidityHours, validSeatCount } from '../src/lib/availability.ts'
import { toPublicPackage } from '../src/lib/catalog.ts'

const now = Date.parse('2026-10-29T18:00:00Z')
const checked = new Date(now - 3600000).toISOString()
const base = { availableSeats: 10, lastSeats: false, seatsCheckedAt: checked, travelDate: '2029-01-01', origin: 1, programRef: 2 }

test('cupos opcionales y cero se distinguen; cantidades fraccionarias o negativas se rechazan', () => {
  for (const value of [null, undefined, '', 0, 1, 10]) assert.equal(validSeatCount(value), true)
  for (const value of [-1, 1.5, NaN, Infinity, '10', Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(validSeatCount(value), false)
    assert.throws(() => prepareSeatReference({ availableSeats: value }, undefined, now))
  }
  assert.equal(prepareSeatReference({}, undefined, now).availableSeats, null)
  assert.equal(prepareSeatReference({ availableSeats: 0, lastSeats: true }, undefined, now).lastSeats, false)
})

test('cantidad y urgencia manual son independientes y se proyectan solo mientras estén vigentes', () => {
  assert.equal(publicAvailability(base, 72, now).seats, 10)
  assert.equal(publicAvailability(base, 72, now).lastSeats, false)
  assert.deepEqual(publicAvailability({ ...base, availableSeats: null, lastSeats: true }, 72, now), { seats: null, lastSeats: true, expiresAt: new Date(now + 71 * 3600000).toISOString() })
  for (const item of [{}, { ...base, availableSeats: 0 }, { ...base, seatsCheckedAt: null }, { ...base, seatsCheckedAt: 'invalid' }, { ...base, seatsCheckedAt: new Date(now + 1).toISOString() }]) assert.equal(publicAvailability(item, 72, now), null)
})

test('vencimiento exclusivo y horas configurables ocultan cantidades también en pestañas abiertas', () => {
  const expiry = now + 71 * 3600000
  assert.ok(publicAvailability(base, 72, expiry - 1))
  assert.equal(publicAvailability(base, 72, expiry), null)
  assert.equal(publicAvailability(base, 1, now), null)
  assert.equal(visibleAvailability(publicAvailability(base, 72, now), expiry), null)
  assert.equal(seatReviewState(base, 1, now), 'stale')
  assert.equal(seatReviewState({}, 72, now), 'missing')
  assert.equal(seatsValidityHours(null), 72)
  assert.equal(seatsValidityHours(24), 24)
  assert.equal(seatsValidityHours(0), 72)
})

test('solo cambiar cupos o confirmar su vigencia renueva la revisión; fecha del cliente se ignora', () => {
  assert.equal(prepareSeatReference({ seatsCheckedAt: '2099-01-01T00:00:00Z' }, base, now).seatsCheckedAt, checked)
  assert.equal(prepareSeatReference({ availableSeats: 10, lastSeats: false }, base, now).seatsCheckedAt, checked)
  assert.equal(prepareSeatReference({ availableSeats: 3 }, base, now).seatsCheckedAt, new Date(now).toISOString())
  assert.equal(prepareSeatReference({ lastSeats: true }, base, now).seatsCheckedAt, new Date(now).toISOString())
  const confirmed = prepareSeatReference({ seatsConfirmed: true }, base, now)
  assert.equal(confirmed.seatsCheckedAt, new Date(now).toISOString())
  assert.equal(confirmed.seatsConfirmed, false)
})

test('cambiar fecha, origen o programa invalida cupos; relaciones pobladas conservan la misma identidad', () => {
  for (const patch of [{ travelDate: '2029-01-02' }, { origin: 3 }, { programRef: 3 }]) {
    assert.deepEqual(prepareSeatReference({ ...patch, seatsConfirmed: true }, base, now), { availableSeats: null, lastSeats: false, seatsCheckedAt: null, seatsConfirmed: false })
  }
  assert.equal(prepareSeatReference({ origin: { id: 1 }, programRef: '2' }, base, now).seatsCheckedAt, checked)
})

test('la proyección pública elimina cupos vencidos y conserva privada la revisión interna', () => {
  const item = { ...base, id: '1', promotions: [] }
  const current = toPublicPackage(item, new Date(now))
  assert.equal(current.availability.seats, 10)
  for (const key of ['availableSeats', 'lastSeats', 'seatsCheckedAt', 'seatsConfirmed']) assert.equal(key in current, false)
  assert.equal(toPublicPackage(item, new Date(now + 72 * 3600000)).availability, null)
})
