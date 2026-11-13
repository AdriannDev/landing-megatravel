import test from 'node:test'
import assert from 'node:assert/strict'
import { compareMailParts, eventKey, extractMailEvent, proposeMovement, resolveMailDeparture } from '../src/lib/mail-pilot.ts'

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
test('localizador opcional; cantidad explícita obligatoria y pasajeros no equivalen a sillas', () => {
  assert.equal(extractMailEvent({ body: mail({ Reserva: '' }) }).event.reservation, undefined)
  assert.match(extractMailEvent({ body: mail({ Sillas: '' }) + '\nPasajeros: 3' }).reason, /sillas/)
  assert.ok(extractMailEvent({ body: mail({ Sillas: '2.5' }) }).reason)
})
test('rechaza campos contradictorios, fechas inexistentes y estados ambiguos', () => {
  assert.ok(extractMailEvent({ body: mail() + '\nSillas: 2' }).reason)
  assert.ok(extractMailEvent({ body: mail({ Salida: '31 nov 2026' }) }).reason)
  assert.ok(extractMailEvent({ body: mail({ Estado: 'pendiente o cancelada' }) }).reason)
  assert.ok(extractMailEvent({ body: mail({ Tipo: 'cancelación' }) }).reason)
})
test('la fecha comercial es opcional; no se inventa a partir del cuerpo del reenvío', () => {
  assert.equal(extractMailEvent({ body: mail({ 'Fecha del evento': '' }) + '\nRecibido: 2026-11-10T17:00:00Z' }).event.occurredAt, undefined)
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
  const cancelled = event({ Sillas: '2', Estado: 'Cancelada', Tipo: 'cancelación', Versión: '3', 'Fecha del evento': '2026-11-12T12:00:00-05:00' })
  assert.equal(cancelled.seats, 2)
  assert.deepEqual(proposeMovement({ ...pool, remainingSeats: 10 }, modified, cancelled), { delta: 2, remainingSeats: 12 })
})
test('vencimiento libera solo las sillas retenidas y una cancelación repetida no suma dos veces', () => {
  const expired = event({ Sillas: '0', Estado: 'Vencida', Tipo: 'vencimiento', Versión: '2', 'Fecha del evento': '2026-11-11T12:00:00-05:00' })
  assert.equal(proposeMovement({ ...pool, remainingSeats: 12 }, event(), expired).remainingSeats, 15)
  const again = { ...expired, version: 3, occurredAt: '2026-11-12T17:00:00Z' }
  assert.equal(proposeMovement(pool, expired, again).delta, 0)
})
test('cancelaciones desconocidas se observan; cualquier primer estado activo descuenta', () => {
  assert.ok(proposeMovement(pool, undefined, { ...event(), status: 'cancelled', kind: 'cancellation', seats: 0 }).reason)
  assert.equal(proposeMovement(pool, undefined, { ...event(), kind: 'modification' }).delta, -3)
  assert.equal(proposeMovement(pool, undefined, { ...event(), status: 'confirmed', kind: 'confirmation' }).delta, -3)
})
test('eventos fuera de orden y versiones incompatibles van a revisión', () => {
  const previous = event()
  assert.ok(proposeMovement(pool, previous, previous).reason)
  assert.equal(proposeMovement(pool, previous, { ...previous, version: undefined, occurredAt: '2026-11-11T17:00:00Z' }).delta, 0)
  assert.ok(proposeMovement(pool, previous, { ...previous, version: 2, occurredAt: '2026-11-09T00:00:00Z' }).reason)
  assert.ok(proposeMovement(pool, undefined, { ...previous, occurredAt: pool.cutoffAt }).reason)
})
test('no se aceptan saldos negativos; cada nuevo estado activo aplica la diferencia ocupada', () => {
  assert.ok(proposeMovement({ ...pool, remainingSeats: 2 }, undefined, event()).reason)
  assert.equal(proposeMovement(pool, { ...event(), status: 'cancelled', seats: 0 }, { ...event(), version: 2 }).delta, -3)
  assert.equal(proposeMovement({ ...pool, remainingSeats: 12 }, event(), { ...event(), kind: 'confirmation', status: 'confirmed', seats: 2, version: 2 }).delta, 1)
})

test('correos mínimos, estados acordados, campos auxiliares opcionales y localizadores equivalentes', () => {
  for (const status of ['A petición', 'Reserva', 'Pendiente de confirmar', 'Cancelado', 'Anulado']) {
    for (const label of ['Localizador', 'Código de reserva', 'Número de reserva', 'Referencia de reserva', 'Código', 'Número', 'Referencia']) {
      const parsed = extractMailEvent({ subject: 'FW: MTPE-50026', body: `${label}: ABC123\nCantidad: 3\nEstado: ${status}` })
      assert.equal(parsed.reason, undefined)
      assert.equal(parsed.event.reservation, 'ABC123'); assert.equal(parsed.event.mtpe, '50026')
      assert.equal(parsed.event.travelDate, undefined); assert.equal(parsed.event.kind, undefined)
      assert.equal(parsed.event.version, undefined); assert.equal(parsed.event.occurredAt, undefined)
    }
  }
  const inline = extractMailEvent({ subject: 'MTPE: 50026 | Localizador: R1 | Cantidad: 3 | Estado: Reserva', body: '' })
  assert.equal(inline.event.seats, 3)
  assert.equal(extractMailEvent({ body: 'MTPE: 50026\nPrograma: Magia Turca\nCantidad: 3\nEstado: Reserva' }).event.mtpe, '50026')
})

test('HTML sin dos puntos y campos identificados sobreviven a una cantidad ausente', () => {
  const parsed = extractMailEvent({ html: true, body: '<table><tr><td>MTPE</td><td>50026</td></tr><tr><td>Localizador</td><td>AB123</td></tr><tr><td>Estado</td><td>Reserva</td></tr></table>' })
  assert.match(parsed.reason, /sillas/); assert.equal(parsed.fields.mtpe, '50026'); assert.equal(parsed.fields.reservation, 'AB123')
  assert.equal(parsed.fields.status, 'confirmed')
})

test('compara partes sin exigir que repitan los auxiliares y bloquea contradicciones', () => {
  const minimal = extractMailEvent({ body: 'MTPE: 50026\nCantidad: 3\nEstado: A petición' })
  assert.equal(compareMailParts(minimal, { fields: { reservation: 'AB123' }, reason: 'Falta el MTPE. Falta la cantidad explícita de sillas; no se cuentan pasajeros. Falta el estado.' }).event.reservation, 'AB123')
  assert.ok(compareMailParts(minimal, extractMailEvent({ body: 'MTPE: 50026\nCantidad: 4\nEstado: A petición' })).reason)
  assert.ok(compareMailParts(minimal, extractMailEvent({ body: 'MTPE: 50026\nCantidad: 3\nEstado: Cancelado' })).reason)
  assert.ok(compareMailParts(extractMailEvent({ body: 'MTPE: 50026\nEstado: Reserva' }), extractMailEvent({ body: 'Cantidad: 0' })).reason)
  assert.ok(compareMailParts(extractMailEvent({ body: 'MTPE: 50026\nCantidad: 3\nTipo: cancelación' }), extractMailEvent({ body: 'Estado: Reserva' })).reason)
})

test('cancelación conocida valida la cantidad y nunca devuelve cupos dos veces', () => {
  const active = { mtpe: '50026', reservation: 'R1', seats: 3, status: 'confirmed' }
  assert.match(proposeMovement({ ...pool, remainingSeats: 12 }, active, { ...active, status: 'cancelled', seats: 2 }).reason, /cantidad/)
  const cancelled = { ...active, status: 'cancelled', occupiedSeats: 0 }
  assert.equal(proposeMovement({ ...pool, remainingSeats: 12 }, active, cancelled).delta, 3)
  assert.equal(proposeMovement(pool, cancelled, cancelled).delta, 0)
  assert.equal(proposeMovement(pool, { ...cancelled, seats: 0, lastActiveSeats: 3 }, cancelled).delta, 0)
})

test('sin orden comercial utiliza el UID y la recepción persistentes, con auxiliares mixtos', () => {
  const previous = { mtpe: '50026', reservation: 'R1', seats: 3, status: 'pending', version: 2, receivedAt: '2026-11-04T00:00:00Z', order: { scope: 'mailbox:123', sequence: 20 } }
  assert.match(proposeMovement(pool, previous, { ...previous, version: undefined, seats: 2, order: { scope: 'mailbox:123', sequence: 19 } }).reason, /antiguo/)
  assert.equal(proposeMovement({ ...pool, remainingSeats: 12 }, previous, { ...previous, version: undefined, seats: 2, order: { scope: 'mailbox:123', sequence: 21 } }).delta, 1)
  assert.match(proposeMovement(pool, previous, { ...previous, version: undefined, order: { scope: 'mailbox:124', sequence: 21 }, receivedAt: '2026-11-03T00:00:00Z' }).reason, /antiguo/)
})

test('MTP sin etiqueta en asunto, cuerpo, HTML y reenvío equivale a la reserva numérica etiquetada', () => {
  for (const input of [
    { subject: 'FW: mtp - 00012345', body: 'MTPE-50026\nCantidad: 3\nEstado: Reserva' },
    { body: '> MTP–00012345\n> MTPE-50026\n> Cantidad: 3\n> Estado: Reserva' },
    { html: true, body: '<table><tr><td>MTP-00012345</td></tr><tr><td>MTPE</td><td>50026</td></tr><tr><td>Cantidad</td><td>3</td></tr><tr><td>Estado</td><td>Reserva</td></tr></table>' },
    { body: 'Reserva: 00012345\nMTPE-50026\nCantidad: 3\nEstado: Reserva' },
  ]) {
    const parsed = extractMailEvent(input)
    assert.equal(parsed.reason, undefined)
    assert.equal(parsed.event.reservation, 'MTP-00012345'); assert.equal(parsed.event.mtpe, '50026')
  }
})
test('varios MTP o referencias contradictorias se observan; MTPE y números aislados no son reservas', () => {
  const base = 'MTPE-50026\nCantidad: 3\nEstado: Reserva'
  assert.ok(extractMailEvent({ body: base + '\nMTP-12345 y MTP-67890' }).reason)
  assert.ok(extractMailEvent({ body: base + '\nReserva: 12345\nMTP-67890' }).reason)
  assert.equal(extractMailEvent({ body: base + '\n12345\n2035-11-21' }).event.reservation, undefined)
  assert.equal(extractMailEvent({ body: base + '\nReserva: 12345\nMTP-12345' }).event.reservation, 'MTP-12345')
})
test('fecha obligatoria salvo fecha única; origen ambiguo bloquea sin usar visibilidad ni saldo', () => {
  const departures = [{ stableId: 'a', travelDate: '2035-06-21', origin: { name: 'Lima' }, availableSeats: 0, status: 'withdrawn' }, { stableId: 'b', travelDate: '2035-06-21', origin: { name: 'Arequipa' }, availableSeats: 15, status: 'published' }]
  assert.ok(resolveMailDeparture(departures, {}).reason)
  assert.equal(resolveMailDeparture(departures, { origin: 'LIMA' }).departure.stableId, 'a')
  assert.ok(resolveMailDeparture([...departures, { ...departures[0], travelDate: '2035-07-21' }], { origin: 'Lima' }).reason)
  assert.equal(resolveMailDeparture([departures[0]], {}).departure.stableId, 'a')
})
test('el orden comercial y el orden persistente se comprueban juntos', () => {
  const previous = { mtpe: '50026', reservation: 'MTP-1', seats: 3, status: 'pending', version: 2, receivedAt: '2026-11-04T00:00:00Z', order: { scope: 'mailbox:123', sequence: 20 } }
  assert.match(proposeMovement(pool, previous, { ...previous, version: 3, order: { scope: 'mailbox:123', sequence: 19 } }).reason, /antiguo/)
  assert.match(proposeMovement(pool, previous, { ...previous, version: 3, order: undefined, receivedAt: '2026-11-03T00:00:00Z' }).reason, /antiguo/)
})
