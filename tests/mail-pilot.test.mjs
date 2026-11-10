import test from 'node:test'
import assert from 'node:assert/strict'
import { eventKey, extractMailEvent, proposeMovement } from '../src/lib/mail-pilot.ts'

const mail = (overrides = {}) => Object.entries({ MTPE: 'MTPE-50026', Reserva: 'DEMO-001', Salida: '21 nov 2026', Sillas: '3', Estado: 'A petición', Tipo: 'reserva', 'Fecha del evento': '2026-11-10T12:00:00-05:00', Versión: '1', ...overrides }).map(([k, v]) => `${k}: ${v}`).join('\n')
const pool = { initialSeats: 15, remainingSeats: 15, cutoffAt: '2026-11-01T00:00:00Z' }
const event = overrides => extractMailEvent({ body: mail(overrides) }).event
test('extrae MTPE, fecha y sillas explícitas sin conservar pasajeros', () => {
  const parsed = extractMailEvent({ body: mail() + '\nPasajero: Nombre Privado\nEmail: privado@example.test' })
  assert.equal(parsed.event.mtpe, '50026'); assert.equal(parsed.event.travelDate, '2026-11-21'); assert.equal(parsed.event.seats, 3)
  assert.equal(parsed.event.status, 'pending'); assert.equal(JSON.stringify(parsed).includes('Privado'), false)
})
test('HTML tabular y reenvíos conservan la huella del evento comercial', () => {
  const html = mail().split('\n').map(line => `<tr><td>${line.split(':')[0]}:</td><td>${line.slice(line.indexOf(':') + 1)}</td></tr>`).join('')
  const parsed = extractMailEvent({ body: `<table>${html}</table>`, html: true })
  assert.deepEqual(parsed.event, event()); assert.equal(eventKey(parsed.event), eventKey(extractMailEvent({ body: 'Mensaje reenviado\n' + mail(), subject: 'FW: RESERVA' }).event))
})
test('sin referencia de reserva o cantidad explícita se requiere revisión; pasajeros no equivalen a sillas', () => {
  assert.match(extractMailEvent({ body: mail({ Reserva: '' }) }).reason, /ausente|ambiguo/)
  assert.match(extractMailEvent({ body: mail({ Sillas: '' }) + '\nPasajeros: 3' }).reason, /sillas/)
  assert.ok(extractMailEvent({ body: mail({ Sillas: '2.5' }) }).reason)
})
test('rechaza campos contradictorios, fechas inexistentes y estados ambiguos', () => {
  assert.ok(extractMailEvent({ body: mail() + '\nSillas: 2' }).reason)
  assert.ok(extractMailEvent({ body: mail({ Salida: '31 nov 2026' }) }).reason)
  assert.ok(extractMailEvent({ body: mail({ Estado: 'pendiente o cancelada' }) }).reason)
  assert.ok(extractMailEvent({ body: mail({ Tipo: 'cancelación' }) }).reason)
})
test('no utiliza la fecha de recepción de un reenvío para ordenar eventos', () => {
  assert.ok(extractMailEvent({ body: mail({ 'Fecha del evento': '' }) + '\nRecibido: 2026-11-10T17:00:00Z' }).reason)
  assert.ok(extractMailEvent({ body: mail({ 'Fecha del evento': '2026-11-10 12:00' }) }).reason)
})
test('A petición descuenta 3 de 15; confirmar mantiene el saldo de 12', () => {
  const pending = event(), proposal = proposeMovement(pool, undefined, pending)
  assert.equal(proposal.delta, -3); assert.equal(proposal.remainingSeats, 12)
  const confirmed = event({ Estado: 'Confirmada', Tipo: 'confirmación', Versión: '2', 'Fecha del evento': '2026-11-11T12:00:00-05:00' })
  assert.deepEqual(proposeMovement({ ...pool, remainingSeats: 12 }, pending, confirmed), { delta: 0, remainingSeats: 12 })
})
test('modificar 3 a 2 devuelve una silla y cancelar solo devuelve las dos restantes', () => {
  const pending = event(), modified = event({ Sillas: '2', Tipo: 'modificación', Versión: '2', 'Fecha del evento': '2026-11-11T12:00:00-05:00' })
  const modification = proposeMovement({ ...pool, remainingSeats: 9 }, pending, modified)
  assert.equal(modification.delta, 1); assert.equal(modification.remainingSeats, 10)
  const cancelled = event({ Sillas: '', Estado: 'Cancelada', Tipo: 'cancelación', Versión: '3', 'Fecha del evento': '2026-11-12T12:00:00-05:00' })
  assert.equal(cancelled.seats, 0)
  assert.deepEqual(proposeMovement({ ...pool, remainingSeats: 10 }, modified, cancelled), { delta: 2, remainingSeats: 12 })
})
test('vencimiento libera solo las sillas retenidas y una cancelación repetida no suma dos veces', () => {
  const expired = event({ Sillas: '', Estado: 'Vencida', Tipo: 'vencimiento', Versión: '2', 'Fecha del evento': '2026-11-11T12:00:00-05:00' })
  assert.equal(proposeMovement({ ...pool, remainingSeats: 12 }, event(), expired).remainingSeats, 15)
  const again = { ...expired, version: 3, occurredAt: '2026-11-12T17:00:00Z' }
  assert.equal(proposeMovement(pool, expired, again).delta, 0)
})
test('cancelaciones, modificaciones y confirmaciones desconocidas no alteran el saldo', () => {
  assert.ok(proposeMovement(pool, undefined, { ...event(), status: 'cancelled', kind: 'cancellation', seats: 0 }).reason)
  assert.ok(proposeMovement(pool, undefined, { ...event(), kind: 'modification' }).reason)
  assert.ok(proposeMovement(pool, undefined, { ...event(), status: 'confirmed', kind: 'confirmation' }).reason)
})
test('eventos fuera de orden y versiones incompatibles van a revisión', () => {
  const previous = event()
  assert.ok(proposeMovement(pool, previous, previous).reason)
  assert.ok(proposeMovement(pool, previous, { ...previous, version: undefined }).reason)
  assert.ok(proposeMovement(pool, previous, { ...previous, version: 2, occurredAt: '2026-11-09T00:00:00Z' }).reason)
  assert.ok(proposeMovement(pool, undefined, { ...previous, occurredAt: pool.cutoffAt }).reason)
})
test('no se aceptan saldos negativos, reaperturas ni cambios de cantidad ocultos en una confirmación', () => {
  assert.ok(proposeMovement({ ...pool, remainingSeats: 2 }, undefined, event()).reason)
  assert.ok(proposeMovement(pool, { ...event(), status: 'cancelled', seats: 0 }, { ...event(), version: 2 }).reason)
  assert.ok(proposeMovement(pool, event(), { ...event(), kind: 'confirmation', status: 'confirmed', seats: 2, version: 2 }).reason)
})
