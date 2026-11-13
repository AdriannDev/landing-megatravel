import test from 'node:test'
import assert from 'node:assert/strict'
import { extractMailEvent, compareMailParts, eventKey, reservationKey } from '../src/lib/mail-pilot.ts'
import { normalizeGmailMessage } from '../src/server/gmail-mail.ts'
import { bookingText, bookingHtml, bookingMime } from './fixtures/real-booking-emails.mjs'

test('correo1 reconoce dos personas y señala únicamente el estado ausente en texto, tabla y multipart', async () => {
  const parts = [extractMailEvent({ body: bookingText(1) }), extractMailEvent({ body: bookingHtml(1), html: true }), (await normalizeGmailMessage(bookingMime(1), ['reservas@example.test'], true)).extraction]
  for (const result of parts) {
    assert.equal(result.fields.seats, 2)
    assert.equal(result.fields.reservation, 'MTP-123456')
    assert.equal(result.reason, 'Falta el estado.')
    assert.equal(result.event, undefined)
  }
  assert.equal(extractMailEvent({ body: bookingText(1, { Estado: 'Reserva' }) }).event.seats, 2)
})

test('correo2 reconoce RQ, salida y referencia comercial; el viaje no identifica ni deduplica la reserva', async () => {
  const parts = [extractMailEvent({ body: bookingText(2) }), extractMailEvent({ body: bookingHtml(2), html: true }), (await normalizeGmailMessage(bookingMime(2), ['reservas@example.test'], true)).extraction]
  for (const { event, reason } of parts) {
    assert.equal(reason, undefined)
    assert.equal(event.seats, 1); assert.equal(event.status, 'pending')
    assert.equal(event.travelDate, '2026-11-21'); assert.equal(event.reservation, 'MTP-CLOSEDTOUR-503866')
    assert.equal(event.tripId, 'MTP-6478')
    const differentTrip = { ...event, tripId: 'MTP-9999' }
    assert.equal(eventKey(event), eventKey(differentTrip)); assert.equal(reservationKey(event), reservationKey(differentTrip))
  }
})

test('combina campos compatibles y conserva errores estructurados aunque cambie su texto', () => {
  const a = extractMailEvent({ body: 'MTPE: 50026\nReservas: 2 personas' })
  const b = extractMailEvent({ body: 'Estado de la reserva: RQ' })
  assert.equal(compareMailParts({ ...a, reason: 'Traducción diferente' }, b).event.seats, 2)
  const invalid = extractMailEvent({ body: 'Pasajeros: 1.5' })
  assert.match(compareMailParts(a, { ...invalid, reason: 'Falta algo.' }).reason, /cantidad.*inválid/)
  assert.match(compareMailParts(a, extractMailEvent({ body: 'Pasajeros: 3' })).reason, /cantidad/)
})

test('solo el ID etiquetado del viaje queda fuera del análisis de referencias contradictorias', () => {
  for (const suffix of ['\nMTP-99999', '\nReferencia: OTRA-RESERVA', '\nMTP-CLOSEDTOUR-999999', '\nMTP-6478']) {
    assert.match(extractMailEvent({ body: bookingText(2) + suffix }).reason, /localizador.*contradictorio/)
  }
  const tripOnly = extractMailEvent({ body: 'ID del viaje: MTP-6478\nMTPE: 50026\nPasajeros: 1\nEstado: RQ' })
  assert.equal(tripOnly.event.reservation, undefined)
  assert.equal(extractMailEvent({ body: bookingText(2, { 'Referencia de la reserva': 'MTP-123456' }) }).event.travelDate, undefined)
})

test('fusiona el contexto Meganet y Comprobación repartidos entre texto y HTML sin perder contradicciones', () => {
  const reference = extractMailEvent({ body: 'Referencia de la reserva: MTP-CLOSEDTOUR-503866\nMTPE: 50026\nPasajeros: 1\nEstado: RQ' })
  const check = extractMailEvent({ html: true, body: '<table><tr><td>Comprobación</td><td>21/11/2026</td></tr></table>' })
  assert.equal(compareMailParts(reference, check).event.travelDate, '2026-11-21')
  assert.match(compareMailParts(reference, extractMailEvent({ body: 'Comprobación: 31/11/2026' })).reason, /fecha.*inválida/)
  assert.match(compareMailParts({ ...reference, fields: { ...reference.fields, travelDate: '2026-11-22' } }, check).reason, /fecha.*contradictoria/)
  const other = extractMailEvent({ body: 'Referencia de la reserva: MTP-123456\nMTPE: 50026\nPasajeros: 1\nEstado: Reserva' })
  assert.equal(compareMailParts(other, check).event.travelDate, undefined)
})

test('no cuenta nombres, documentos, edades ni filas y rechaza totales ambiguos', () => {
  for (const passengers of ['Persona A, Persona B', '1 adulto y 1 niño', '2.5', '-1', 'DNI 12345678', '1 35 años']) {
    const result = extractMailEvent({ body: bookingText(2, { Pasajeros: passengers }) })
    assert.equal(result.event, undefined); assert.match(result.reason, /cantidad.*inválid/)
  }
  const list = extractMailEvent({ html: true, body: bookingHtml(2, { Pasajeros: undefined }) + '<table><tr><td>Persona A</td><td>35 años</td></tr><tr><td>Persona B</td><td>Documento 12345678</td></tr></table>' })
  assert.match(list.reason, /Falta la cantidad/)
  assert.equal(list.fields.seats, undefined)
})

test('reenvíos de texto y adjuntos MIME conservan el evento sin relajar la autenticación exterior', async () => {
  const original = extractMailEvent({ body: bookingText(2) }).event
  assert.equal(eventKey(extractMailEvent({ subject: 'FW: Aviso', body: bookingText(2).split('\n').map(line => '> ' + line).join('\n') }).event), eventKey(original))
  const forwarded = Buffer.concat([Buffer.from('Authentication-Results: mx.google.com; dmarc=pass header.from=example.test\r\nFrom: reservas@example.test\r\nMIME-Version: 1.0\r\nContent-Type: message/rfc822\r\n\r\n'), bookingMime(2)])
  const normalized = await normalizeGmailMessage(forwarded, ['reservas@example.test'], true)
  assert.equal(normalized.trusted, true); assert.equal(eventKey(normalized.extraction.event), eventKey(original))
  const spoofed = await normalizeGmailMessage(Buffer.concat([Buffer.from('Authentication-Results: mx.google.com; dmarc=fail header.from=example.test\r\n'), bookingMime(2)]), ['reservas@example.test'], true)
  assert.equal(spoofed.trusted, false)
})
