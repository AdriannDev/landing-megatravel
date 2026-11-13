// Anonymized commercial fields only. No customer names, documents or addresses.
export const bookingRows = (example, overrides = {}) => Object.entries({
  ...(example === 1 ? {
    'Referencia de la reserva': 'MTP-123456',
    Programa: 'Programa de prueba MTPE-50026',
    Salida: '21/11/2026',
    Reservas: '2 personas',
  } : {
    'ID del viaje': 'MTP-6478',
    'Referencia de la reserva': 'MTP-CLOSEDTOUR-503866',
    Programa: 'Programa de prueba MTPE-50026',
    Comprobación: '21/11/2026',
    Pasajeros: '1',
    'Estado de la reserva': 'RQ',
  }),
  ...overrides,
}).filter(([, value]) => value !== undefined)

export const bookingText = (example, overrides) => bookingRows(example, overrides).map(([label, value]) => `${label}: ${value}`).join('\n')
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
export const bookingHtml = (example, overrides) => `<table>${bookingRows(example, overrides).map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value)}</td></tr>`).join('')}</table>`
export const bookingMime = (example, overrides, { text = bookingText(example, overrides), html = bookingHtml(example, overrides) } = {}) => Buffer.from([
  'Authentication-Results: mx.google.com; dmarc=pass header.from=example.test',
  'From: Avisos <reservas@example.test>',
  'Subject: Aviso de reserva',
  'MIME-Version: 1.0',
  'Content-Type: multipart/alternative; boundary="booking-example"', '',
  '--booking-example', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '',
  Buffer.from(text).toString('base64'),
  '--booking-example', 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '',
  Buffer.from(html).toString('base64'), '--booking-example--', '',
].join('\r\n'))
