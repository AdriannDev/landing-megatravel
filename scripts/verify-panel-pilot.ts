// Real Payload hooks, transactions and simulated Graph responses; isolated SQLite, never a real mailbox.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
process.env.USE_SQLITE = 'true'
Object.assign(process.env, { NODE_ENV: 'test' })
process.env.PAYLOAD_SECRET = randomUUID() + randomUUID()
process.env.SQLITE_URL = 'file:./.qa/panel-pilot-' + randomUUID() + '.db'
process.env.R2_BUCKET = ''
await mkdir('.qa', { recursive: true })
const [{ getPayload, createLocalReq }, { default: config }, { createDepartures }, { deletionPreview, deleteSelection }, { createPilotPool, processPilotMail }, { syncMicrosoftMailbox, validateGraphCursor, runMicrosoftMailPilot }] = await Promise.all([
  import('payload'), import('../src/payload.config'), import('../src/server/departure-service'), import('../src/server/deletion-service'), import('../src/server/mail-pilot-service'), import('../src/server/microsoft-mail'),
])
const payload = await getPayload({ config })
let checks = 0
try {
  const password = randomUUID()
  const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { bootstrap: true }, data: { name: 'QA piloto', email: 'panel-pilot@example.test', password, role: 'admin' } })
  const req = await createLocalReq({ user: { ...admin, collection: 'users' } }, payload)
  const editor = await payload.create({ collection: 'users', req, overrideAccess: false, data: { name: 'QA editor', email: 'pilot-editor@example.test', password: randomUUID(), role: 'editor' } })
  const editorReq = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const fresh = () => createLocalReq({ user: { ...admin, collection: 'users' } }, payload)
  const make = (mtpe: string, dates = ['2035-11-21']) => createDepartures(payload, req, { program: { program: `Programa ${mtpe}`, mtpe, destination: 'Madrid', zone: 'Europa', days: 8, availableSeats: 15, seatsConfirmed: true, bookingUrl: 'https://www.megatravel.pe/', descriptionUrl: 'https://cafe.megatravel.pe/' }, origin: 'Lima', departures: dates.map(date => ({ date, price: 2000 })) })
  const remove = async (collection: 'programs' | 'departures', ids: (string | number)[]) => deleteSelection(req, collection, ids, await deletionPreview(req, collection, ids))
  const count = async (collection: 'programs' | 'departures' | 'audit-log' | 'seat-mail-events' | 'seat-pilot-reservations') => (await payload.count({ collection, req })).totalDocs
  const departures = await make('DELETE1', ['2035-11-21', '2035-11-22', '2035-11-23'])
  await payload.update({ collection: 'departures', id: departures.created[0].id, req, data: { status: 'published' } })
  await payload.update({ collection: 'departures', id: departures.created[1].id, req, data: { status: 'withdrawn', withdrawalReason: 'request' } })
  await assert.rejects(deletionPreview(editorReq, 'departures', departures.created.map(doc => doc.id)), /administrador/)
  await assert.rejects(payload.delete({ collection: 'departures', id: departures.created[0].id, req: editorReq, overrideAccess: false })); checks++
  assert.deepEqual(await remove('departures', departures.created.map(doc => doc.id)), { programs: 0, departures: 3 })
  const deletionLogs = await payload.find({ collection: 'audit-log', req, where: { event: { equals: 'deleted' } }, pagination: false })
  assert.equal(deletionLogs.docs.length, 3)
  for (const log of deletionLogs.docs) { const snapshot = (log.changes as any).deleted.before; assert.equal(snapshot.price, 2000); assert.ok(snapshot.stableId); assert.equal(log.actorLabel, admin.email) }; checks++
  await assert.rejects(remove('departures', [departures.created[0].id]), /no existe/); checks++
  const grouped = await make('DELETE2', ['2035-11-21', '2035-11-22'])
  const emptyID = departures.programId
  const summary = await deletionPreview(req, 'programs', [grouped.programId, emptyID])
  assert.equal(summary.programs, 2); assert.equal(summary.departures, 2)
  await assert.rejects(payload.delete({ collection: 'programs', id: grouped.programId, req, overrideAccess: false })); checks++
  await payload.update({ collection: 'departures', id: grouped.created[0].id, req, data: { price: 2100 } })
  await assert.rejects(deleteSelection(req, 'programs', [grouped.programId, emptyID], summary), /cambiaron/); checks++
  const before = { programs: await count('programs'), departures: await count('departures'), audit: await count('audit-log') }
  const failing = ({ id }: { id: string | number }) => { if (id === grouped.created[1].id) throw new Error('Fallo de borrado deliberado') }
  payload.collections.departures.config.hooks.beforeDelete.push(failing)
  try { await assert.rejects(remove('programs', [grouped.programId, emptyID]), /Fallo de borrado/) }
  finally { payload.collections.departures.config.hooks.beforeDelete.pop() }
  assert.deepEqual({ programs: await count('programs'), departures: await count('departures'), audit: await count('audit-log') }, before); checks++
  const destinationsBefore = (await payload.count({ collection: 'destinations', req })).totalDocs
  assert.deepEqual(await remove('programs', [grouped.programId, emptyID]), { programs: 2, departures: 2 })
  assert.equal((await payload.count({ collection: 'destinations', req })).totalDocs, destinationsBefore)
  const programLogs = await payload.find({ collection: 'audit-log', req, where: { entityType: { equals: 'program' } }, pagination: false })
  assert.equal(programLogs.docs.length, 2); assert.ok((programLogs.docs[0].changes as any).deleted.before.mtpe); checks++

  const program = await make('MTPE-50026', ['2035-11-21', '2035-12-21'])
  const body = (overrides: Record<string, string> = {}) => Object.entries({ MTPE: 'MTPE-50026', Reserva: 'R-001', Salida: '21 nov 2035', Sillas: '3', Estado: 'A petición', Tipo: 'reserva', 'Fecha del evento': '2026-11-03T12:00:00-05:00', Versión: '1', ...overrides }).map(([k, v]) => `${k}: ${v}`).join('\n')
  const mail = (id: string, text = body(), trusted = true) => processPilotMail(req, { id, mailbox: 'qa', body: text, trusted })
  const pool = await createPilotPool(req, { mtpe: '50026', initialSeats: 15, cutoffAt: '2026-11-01T00:00:00Z' })
  const balance = async () => (await payload.findByID({ collection: 'seat-pilot-pools', id: pool.id, req })).remainingSeats
  await assert.rejects(createPilotPool(req, { mtpe: '50026', initialSeats: 15, cutoffAt: '2026-11-01T00:00:00Z' }), /Ya existe/)
  await assert.rejects(createPilotPool(editorReq, { mtpe: '50026', initialSeats: 15, cutoffAt: '2026-11-01T00:00:00Z' }), /administrador/); checks++
  const first = await mail('message-1'); assert.equal(first.delta, -3); assert.equal(await balance(), 12)
  assert.equal((await mail('message-1')).id, first.id)
  assert.equal((await mail('forward-1')).outcome, 'duplicate'); assert.equal(await balance(), 12); checks++
  const confirmed = await mail('confirm-1', body({ Tipo: 'confirmación', Estado: 'Confirmada', Versión: '2', 'Fecha del evento': '2026-11-04T12:00:00-05:00' }))
  assert.equal(confirmed.delta, 0); assert.equal(await balance(), 12); checks++
  await mail('other-booking', body({ Reserva: 'R-002', Sillas: '4' })); assert.equal(await balance(), 8)
  const modified = await mail('modify-1', body({ Tipo: 'modificación', Sillas: '2', Estado: 'Confirmada', Versión: '3', 'Fecha del evento': '2026-11-05T12:00:00-05:00' }))
  assert.equal(modified.delta, 1); assert.equal(await balance(), 9)
  const cancel = body({ Tipo: 'cancelación', Estado: 'Cancelada', Sillas: '2', Versión: '4', 'Fecha del evento': '2026-11-06T12:00:00-05:00' })
  assert.equal((await mail('cancel-1', cancel)).delta, 2); assert.equal(await balance(), 11)
  assert.equal((await mail('cancel-forward', cancel)).outcome, 'duplicate'); assert.equal(await balance(), 11); checks++
  assert.equal((await mail('old-event', body({ Versión: '2', Sillas: '8' }))).outcome, 'review')
  assert.equal((await mail('unknown-cancel', body({ Reserva: 'UNKNOWN', Tipo: 'cancelación', Estado: 'Cancelada', Sillas: '' }))).outcome, 'review')
  assert.equal((await mail('missing-seat', body({ Reserva: 'INCOMPLETE', Sillas: '' }) + '\nPasajero: PRIVADO-NO-GUARDAR')).outcome, 'review')
  assert.equal((await mail('untrusted', body({ Reserva: 'UNTRUSTED' }), false)).outcome, 'review')
  assert.equal((await mail('before-cutoff', body({ Reserva: 'OLD', 'Fecha del evento': '2026-10-01T12:00:00-05:00' }))).outcome, 'review')
  assert.equal((await mail('wrong-date', body({ Reserva: 'WRONG-DATE', Salida: '21 nov 2036' }))).outcome, 'review')
  assert.equal(await balance(), 11)
  assert.equal(JSON.stringify((await payload.find({ collection: 'seat-mail-events', req, pagination: false })).docs).includes('PRIVADO-NO-GUARDAR'), false); checks++
  const expire = body({ Reserva: 'R-002', Tipo: 'vencimiento', Estado: 'Vencida', Sillas: '4', Versión: '2', 'Fecha del evento': '2026-11-07T12:00:00-05:00' })
  assert.equal((await mail('expire-2', expire)).delta, 4); assert.equal(await balance(), 15); checks++
  // Force failure after the balance update: state, balance and ledger must all roll back.
  const beforeFailure = { balance: await balance(), reservations: await count('seat-pilot-reservations'), events: await count('seat-mail-events') }
  payload.collections['seat-mail-events'].config.hooks.beforeChange.push(() => { throw new Error('Fallo de evento deliberado') })
  try { await assert.rejects(mail('rollback', body({ Reserva: 'ROLLBACK' })), /Fallo de evento/) }
  finally { payload.collections['seat-mail-events'].config.hooks.beforeChange.pop() }
  assert.deepEqual({ balance: await balance(), reservations: await count('seat-pilot-reservations'), events: await count('seat-mail-events') }, beforeFailure); checks++
  // Independent request/transaction objects reproduce worker concurrency.
  const concurrent = await Promise.all([1, 2].map(async n => processPilotMail(await fresh(), { id: `concurrent-${n}`, mailbox: 'qa', trusted: true, body: body({ Reserva: 'CONCURRENT' }) })))
  assert.equal(concurrent.filter(doc => doc.outcome === 'proposed').length, 1); assert.equal(concurrent.filter(doc => doc.outcome === 'duplicate').length, 1)
  assert.equal(await balance(), 12); checks++
  for (const doc of program.created) assert.equal((await payload.findByID({ collection: 'departures', id: doc.id, req })).availableSeats, 15)
  assert.equal((await payload.findByID({ collection: 'programs', id: program.programId, req })).availableSeats, 15)
  for (const collection of ['seat-pilot-pools', 'seat-pilot-reservations', 'seat-mail-events', 'mail-sync-cursors'] as const) {
    await assert.rejects(payload.find({ collection, overrideAccess: false }))
    await assert.rejects(payload.find({ collection, req: editorReq, overrideAccess: false }))
    assert.ok((await payload.find({ collection, req, overrideAccess: false })).totalDocs >= 0)
    if (collection !== 'seat-mail-events') assert.equal(payload.collections[collection].config.admin.hidden, true)
  }; checks++
  assert.equal(payload.collections['seat-mail-events'].config.labels.plural, 'Correos observados')

  const graphConfig = { tenant: 'tenant.test', client: 'test-client', secret: 'test-secret', mailbox: 'qa@example.test', folder: 'Inbox', senders: ['reservas@example.test'] }
  const url = 'https://graph.microsoft.com/v1.0/users/qa%40example.test/mailFolders/Inbox/messages/delta'
  assert.throws(() => validateGraphCursor('https://evil.test/delta', graphConfig))
  assert.throws(() => validateGraphCursor(url.replace('Inbox', 'Other'), graphConfig)); checks++
  let failSecondPage = true, calls: string[] = []
  const fakeGraph = async (input: string | URL | Request) => {
    const address = String(input); calls.push(address)
    if (address.includes('/oauth2/')) return Response.json({ access_token: 'qa-token' })
    if (address.includes('page=2')) {
      if (failSecondPage) return new Response('', { status: 500 })
      return Response.json({ value: [{ id: 'graph-forward', from: { emailAddress: { address: 'reservas@example.test' } }, body: { contentType: 'text', content: body({ Reserva: 'GRAPH' }) } }], '@odata.deltaLink': url + '?delta=done' })
    }
    if (address.includes('delta=done')) return Response.json({ value: [], '@odata.deltaLink': url + '?delta=done' })
    return Response.json({ value: [{ id: 'graph-1', from: { emailAddress: { address: 'reservas@example.test' } }, body: { contentType: 'text', content: body({ Reserva: 'GRAPH' }) } }], '@odata.nextLink': url + '?page=2' })
  }
  await assert.rejects(syncMicrosoftMailbox(payload, graphConfig, fakeGraph as typeof fetch), /HTTP 500/)
  assert.equal(await balance(), 9)
  failSecondPage = false; calls = []
  await syncMicrosoftMailbox(payload, graphConfig, fakeGraph as typeof fetch)
  assert.ok(calls[1].includes('page=2')); assert.equal(await balance(), 9)
  const resumed = await syncMicrosoftMailbox(payload, graphConfig, fakeGraph as typeof fetch)
  assert.equal(resumed.processed, 0); assert.equal(await balance(), 9); checks++
  let release: () => void = () => {}, entered: () => void = () => {}
  const gate = new Promise<void>(resolve => { release = resolve }), ready = new Promise<void>(resolve => { entered = resolve })
  const blockingFetch = async (input: string | URL | Request) => { if (String(input).includes('/oauth2/')) { entered(); await gate }; return fakeGraph(input) }
  const running = syncMicrosoftMailbox(payload, graphConfig, blockingFetch as typeof fetch)
  await ready
  assert.equal((await syncMicrosoftMailbox(payload, graphConfig, fakeGraph as typeof fetch)).status, 'busy')
  release(); await running; checks++
  const expiredCursor = async (input: string | URL | Request) => String(input).includes('/oauth2/') ? Response.json({ access_token: 'qa-token' }) : new Response('', { status: 410 })
  await assert.rejects(syncMicrosoftMailbox(payload, graphConfig, expiredCursor as typeof fetch), /HTTP 410/)
  calls = []
  await syncMicrosoftMailbox(payload, graphConfig, fakeGraph as typeof fetch)
  assert.ok(!calls[1].includes('delta=done') && !calls[1].includes('page=2'))
  assert.equal(await balance(), 9); checks++
  process.env.SEAT_MAIL_PILOT_ENABLED = 'false'
  assert.equal((await runMicrosoftMailPilot(payload)).status, 'disabled'); checks++
  await remove('programs', [program.programId])
  assert.equal((await mail('deleted-program', body({ Reserva: 'AFTER-DELETE' }))).outcome, 'review')
  assert.equal(await balance(), 9); checks++
  const replacement = await make('MTPE-50026')
  assert.equal((await mail('replaced-program', body({ Reserva: 'AFTER-REPLACEMENT' }))).outcome, 'review')
  assert.equal(await balance(), 9)
  await remove('programs', [replacement.programId]); checks++
  // Leave a disposable fixture for browser verification, with a private test session.
  const ui = await make('UI-50029', ['2035-11-21', '2035-12-21'])
  await payload.update({ collection: 'departures', id: ui.created[0].id, req, data: { status: 'published' } })
  const { token } = await payload.login({ collection: 'users', data: { email: admin.email, password } })
  await writeFile('.qa/panel-pilot-ui-env.json', JSON.stringify({ USE_SQLITE: 'true', SQLITE_URL: process.env.SQLITE_URL, PAYLOAD_SECRET: process.env.PAYLOAD_SECRET, NEXT_PUBLIC_SITE_URL: 'http://localhost:3100', CATALOG_SOURCE: 'cms', R2_BUCKET: '', MEDIA_DIR: path.resolve('.qa/pilot-media') }))
  await writeFile('.qa/panel-pilot-ui-cookie.json', JSON.stringify([{ name: 'payload-token', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }]))
  console.log(`${checks} comprobaciones de panel/piloto correctas. Fixture de navegador en .qa/panel-pilot-ui-env.json (solo prueba).`)
} finally { await payload.destroy() }
