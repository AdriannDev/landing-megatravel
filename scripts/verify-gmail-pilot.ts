// Real Payload transactions + in-memory IMAP transport. Never a real mailbox.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { GmailClient, GmailClientFactory } from '../src/server/gmail-mail'
process.env.USE_SQLITE = 'true'
Object.assign(process.env, { NODE_ENV: 'test' })
process.env.PAYLOAD_SECRET = randomUUID() + randomUUID()
process.env.SQLITE_URL = 'file:./.qa/gmail-pilot-' + randomUUID() + '.db'
process.env.R2_BUCKET = ''
await mkdir('.qa', { recursive: true })
const [{ getPayload, createLocalReq }, { default: config }, { createDepartures }, { createPilotPool }, { syncGmailMailbox, normalizeGmailMessage, gmailMailConfig, createGmailClient }, { runMailPilot }] = await Promise.all([
  import('payload'), import('../src/payload.config'), import('../src/server/departure-service'), import('../src/server/mail-pilot-service'), import('../src/server/gmail-mail'), import('../src/server/seat-mail-provider'),
])
const payload = await getPayload({ config })
let checks = 0
try {
  const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { bootstrap: true }, data: { name: 'QA Gmail', email: 'gmail-pilot@example.test', password: randomUUID(), role: 'admin' } })
  const req = await createLocalReq({ user: { ...admin, collection: 'users' } }, payload)
  const program = await createDepartures(payload, req, { program: { program: 'QA Gmail', mtpe: 'MTPE-50026', destination: 'Madrid', zone: 'Europa', days: 8, availableSeats: 15, seatsConfirmed: true, bookingUrl: 'https://www.megatravel.pe/', descriptionUrl: 'https://cafe.megatravel.pe/' }, origin: 'Lima', departures: [{ date: '2035-11-21', price: 2000 }] })
  const pool = await createPilotPool(req, { mtpe: '50026', initialSeats: 15, cutoffAt: '2026-11-01T00:00:00Z' })
  const body = (overrides: Record<string, string> = {}) => Object.entries({ MTPE: 'MTPE-50026', Reserva: 'GMAIL-001', Salida: '21 nov 2035', Sillas: '3', Estado: 'A petición', Tipo: 'reserva', 'Fecha del evento': '2026-11-03T12:00:00-05:00', Versión: '1', ...overrides }).map(([k,v]) => `${k}: ${v}`).join('\n')
  const mime = (text = body(), from = 'reservas@example.test') => Buffer.from(`From: Avisos <${from}>\r\nTo: piloto@example.test\r\nSubject: Fwd: Aviso privado\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(text).toString('base64')}\r\n`)
  const gmail = { user: 'piloto@example.test', password: 'private-secret', folder: 'INBOX', senders: ['reservas@example.test'] }
  const configured = createGmailClient(gmail)
  assert.equal(configured instanceof Object, true) // Construction never connects.
  assert.throws(() => gmailMailConfig(), /Falta configurar/); checks++
  const balance = async () => (await payload.findByID({ collection: 'seat-pilot-pools', id: pool.id, req })).remainingSeats
  const state = async () => (await payload.find({ collection: 'mail-sync-cursors', req, pagination: false })).docs[0]
  const messages = new Map<number, Buffer>([[1, mime('Mensaje reenviado\n' + body().split('\n').map(l => '> ' + l).join('\n'))], [2, mime()]])
  let validity = 123n, failUid = 2, failAuth = false, readonly = true
  let connectGate: (() => Promise<void>) | undefined
  const fetched: number[] = [], searched: string[] = []
  const factory: GmailClientFactory = () => ({
    on() { return this }, close() {}, async logout() {},
    async connect() { if (connectGate) await connectGate(); if (failAuth) throw new Error('AUTH private-secret PRIVATE-PASSENGER') },
    async mailboxOpen(folder: string, options: { readOnly: boolean }) { assert.equal(folder, 'INBOX'); assert.deepEqual(options, { readOnly: true }); return { uidValidity: validity, readOnly: readonly } },
    async search(query: { uid: string }, options: { uid: boolean }) {
      assert.deepEqual(Object.keys(query), ['uid']); assert.deepEqual(options, { uid: true }); searched.push(query.uid)
      const start = Number(query.uid.split(':')[0]), all = [...messages.keys()]
      return all.filter(uid => uid >= start || uid === Math.max(...all)) // '*' reversed-range behavior.
    },
    async fetchOne(uid: number, query: { uid: boolean; size: boolean; source: { start: number; maxLength: number } }, options: unknown) {
      assert.equal(query.uid, true)
      assert.equal(query.size, true)
      assert.equal(query.source.start, 0)
      assert.deepEqual(options, { uid: true })
      fetched.push(uid); if (uid === failUid) throw new Error('interrupted')
      const source = messages.get(uid)
      return source ? { uid, internalDate: new Date('2026-11-11T15:00:00Z'), source: source.subarray(0, query.source.maxLength), size: source.length } : false
    },
  } as unknown as GmailClient)

  // Failure after UID 1: seen and unseen are selected alike, checkpoint survives restart.
  await assert.rejects(syncGmailMailbox(payload, gmail, factory), /progreso confirmado/)
  assert.equal((await state()).lastUid, 1); assert.equal(await balance(), 12); assert.equal((await state()).owner, null); checks++
  failUid = 0
  messages.set(3, mime(body({ Tipo: 'modificación', Sillas: '2', Versión: '2', 'Fecha del evento': '2026-11-04T12:00:00-05:00' })))
  messages.set(4, mime(body({ Tipo: 'cancelación', Estado: 'Cancelada', Sillas: '2', Versión: '3', 'Fecha del evento': '2026-11-05T12:00:00-05:00' })))
  assert.equal((await syncGmailMailbox(payload, gmail, factory)).processed, 3)
  assert.equal(searched.at(-1), '2:*'); assert.equal(await balance(), 15)
  const last = await state(); assert.equal(last.provider, 'gmail-imap'); assert.equal(last.uidValidity, '123'); assert.equal(last.lastUid, 4)
  assert.equal((await syncGmailMailbox(payload, gmail, factory)).processed, 0); checks++
  // New UIDVALIDITY replays safely, even with new message IDs.
  validity = 124n
  assert.equal((await syncGmailMailbox(payload, gmail, factory)).processed, 4)
  assert.equal(await balance(), 15); assert.equal(searched.at(-1), '1:*'); checks++
  // Failure after balance update rolls back event, reservation, balance AND checkpoint.
  messages.set(5, mime(body({ Reserva: 'ROLLBACK' }) + '\nPasajero: PRIVATE-PASSENGER'))
  payload.collections['seat-mail-events'].config.hooks.beforeChange.push(() => { throw new Error('deliberate failure') })
  try { await assert.rejects(syncGmailMailbox(payload, gmail, factory), /progreso confirmado/) }
  finally { payload.collections['seat-mail-events'].config.hooks.beforeChange.pop() }
  assert.equal((await state()).lastUid, 4); assert.equal(await balance(), 15)
  await syncGmailMailbox(payload, gmail, factory); assert.equal(await balance(), 12); assert.equal((await state()).lastUid, 5); checks++
  failAuth = true
  try { await syncGmailMailbox(payload, gmail, factory); assert.fail('authentication must fail') } catch (error) { assert.doesNotMatch((error as Error).message, /private-secret|PRIVATE-PASSENGER/) }
  assert.equal((await state()).lastUid, 5); assert.equal((await state()).owner, null)
  failAuth = false; await syncGmailMailbox(payload, gmail, factory); checks++
  // Independent workers must not open two IMAP connections for the same folder.
  let release!: () => void, entered!: () => void
  const gate = new Promise<void>(r => { release = r }), ready = new Promise<void>(r => { entered = r })
  connectGate = async () => { entered(); await gate }
  const running = syncGmailMailbox(payload, gmail, factory)
  await ready
  assert.equal((await syncGmailMailbox(payload, gmail, factory)).status, 'busy')
  release(); await running; connectGate = undefined; checks++
  readonly = false; await assert.rejects(syncGmailMailbox(payload, gmail, factory), /solo lectura/); readonly = true; checks++
  // Large backlogs are bounded and resume on the next cron. Expunged mail has no seat effect.
  for (let uid = 6; uid <= 507; uid++) messages.set(uid, Buffer.alloc(0))
  const goneFactory: GmailClientFactory = cfg => {
    const client = factory(cfg); client.fetchOne = async () => false; return client
  }
  assert.equal((await syncGmailMailbox(payload, gmail, goneFactory)).pending, true)
  assert.equal((await state()).lastUid, 505)
  assert.equal((await syncGmailMailbox(payload, gmail, goneFactory)).pending, false)
  assert.equal((await state()).lastUid, 507); assert.equal(await balance(), 12); checks++
  const normalized = await normalizeGmailMessage(mime(body(), 'intruder@example.test'), gmail.senders)
  assert.equal(normalized.trusted, false)
  const html = '<table>' + body().split('\n').map(line => `<tr><td>${line.slice(0, line.indexOf(':') + 1)}</td><td>${line.slice(line.indexOf(':') + 1)}</td></tr>`).join('') + '</table>'
  const multi = (plain: string, rich = html) => Buffer.from(`From: reservas@example.test\r\nMIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary="b"\r\n\r\n--b\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${plain}\r\n--b\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${rich}\r\n--b--`)
  assert.equal((await normalizeGmailMessage(multi(body()), gmail.senders)).reviewReason, undefined)
  assert.match((await normalizeGmailMessage(multi(body({ Sillas: '4' })), gmail.senders)).reviewReason!, /no identifican/); checks++
  const events = (await payload.find({ collection: 'seat-mail-events', req, pagination: false })).docs
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE-PASSENGER|private-secret|Content-Type/)
  assert.ok(events.some(event => event.subject === 'Fwd: Aviso privado' && event.sender === 'reservas@example.test'))
  assert.equal((await payload.findByID({ collection: 'programs', id: program.programId, req })).availableSeats, 15)
  assert.equal((await payload.findByID({ collection: 'departures', id: program.created[0].id, req })).availableSeats, 15); checks++

  // Exercise the same IMAP entry point with a real program balance and no simulated pool.
  const realProgram = await createDepartures(payload, req, {
    program: { program: 'MAGIA TURCA', mtpe: '20141', destination: 'Estambul', zone: 'Europa', days: 8, availableSeats: 9, seatsConfirmed: true, bookingUrl: 'https://www.megatravel.pe/', descriptionUrl: 'https://cafe.megatravel.pe/' },
    origin: 'Lima', departures: [{ date: '2035-11-21', price: 2000 }],
  })
  const live = { ...gmail, live: { cutoffAt: '2026-11-01T00:00:00Z', mtpes: ['20141'] } }
  await payload.db.updateOne({ collection: 'departures', id: realProgram.created[0].id, req, data: { seatsReconciledAt: '2026-11-01T00:00:00Z' } })
  const realBalance = async () => (await payload.findByID({ collection: 'departures', id: realProgram.created[0].id, req })).availableSeats
  const realAudit = async () => (await payload.find({ collection: 'audit-log', req, pagination: false, where: { and: [{ departureId: { equals: (await payload.findByID({ collection: 'departures', id: realProgram.created[0].id, req })).stableId } }, { actorLabel: { equals: 'Automatización de cupos por correo' } }] } })).docs
  const realBody = (overrides: Record<string, string> = {}) => body({ MTPE: 'MTPE-20141', Reserva: 'REAL-001', ...overrides })
  const signed = (text: string) => Buffer.concat([Buffer.from('Authentication-Results: mx.google.com; dmarc=pass header.from=example.test\r\n'), mime(text)])
  messages.clear()
  let realUid = 0
  const readReal = async (source: Buffer) => {
    messages.set(++realUid, source)
    const result = await syncGmailMailbox(payload, live, factory)
    assert.equal(result.mode, 'live')
    assert.equal(result.processed, 1)
  }
  const spoofed = Buffer.concat([
    Buffer.from('Authentication-Results: mx.google.com; dmarc=fail header.from=example.test\r\n'),
    signed(realBody()),
  ])
  await readReal(spoofed)
  await readReal(signed(realBody({ Reserva: 'ANTES-CORTE', 'Fecha del evento': '2026-10-31T12:00:00-05:00' })))
  await readReal(signed(body({ Reserva: 'FUERA-ALCANCE' })))
  assert.equal(await realBalance(), 9)
  assert.equal((await realAudit()).length, 0); checks++

  // A signature image can make a valid reservation larger than the previous 1 MB limit.
  const signature = Buffer.alloc(2_200_000).toString('base64').match(/.{1,76}/g)!.join('\r\n')
  const withSignature = Buffer.from([
    'Authentication-Results: mx.google.com; dmarc=pass header.from=example.test',
    'From: Avisos <reservas@example.test>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="signature"',
    '',
    '--signature',
    'Content-Type: text/plain; charset=utf-8',
    '',
    realBody(),
    '--signature',
    'Content-Type: image/png; name="firma.png"',
    'Content-Transfer-Encoding: base64',
    'Content-Disposition: attachment; filename="firma.png"',
    '',
    signature,
    '--signature--',
    '',
  ].join('\r\n'))
  assert.ok(withSignature.length > 2_900_000)
  await readReal(withSignature)
  assert.equal(await realBalance(), 6)
  assert.equal((await payload.findByID({ collection: 'departures', id: realProgram.created[0].id, req, context: { skipProgramResolution: true } })).availableSeats, 6)
  assert.deepEqual((await realAudit()).map(log => (log.changes as any).availableSeats), [{ before: 9, after: 6 }]); checks++
  await readReal(signed(realBody()))
  await readReal(signed(realBody({ Estado: 'Confirmada', Tipo: 'confirmación', Versión: '2' })))
  assert.equal(await realBalance(), 6)
  assert.equal((await realAudit()).length, 1); checks++
  await readReal(signed(realBody({ Sillas: '2', Estado: 'Confirmada', Tipo: 'modificación', Versión: '3' })))
  assert.equal(await realBalance(), 7)
  await readReal(signed(realBody({ Sillas: '0', Estado: 'Cancelada', Tipo: 'cancelación', Versión: '4' })))
  await readReal(signed(realBody({ Reserva: 'EXCESO', Sillas: '10' })))
  assert.equal(await realBalance(), 9)
  assert.equal((await realAudit()).length, 3)
  assert.equal(await balance(), 12); checks++

  // If recording the event fails, roll back the public seat update, audit and IMAP progress.
  messages.set(++realUid, signed(realBody({ Reserva: 'REAL-ROLLBACK' })))
  payload.collections['seat-mail-events'].config.hooks.beforeChange.push(() => { throw new Error('deliberate live failure') })
  try { await assert.rejects(syncGmailMailbox(payload, live, factory), /progreso confirmado/) }
  finally { payload.collections['seat-mail-events'].config.hooks.beforeChange.pop() }
  assert.equal(await realBalance(), 9)
  assert.equal((await realAudit()).length, 3)
  assert.equal((await syncGmailMailbox(payload, live, factory)).processed, 1)
  assert.equal(await realBalance(), 6)
  assert.equal((await syncGmailMailbox(payload, live, factory)).processed, 0); checks++

  // Minimal real notices: identity, quantity differences, warnings, observations
  // and recovery use the production entry point with a simulated transport.
  const minimalProgram = await createDepartures(payload, req, {
    program: { program: 'QA mínimos', mtpe: '20142', destination: 'Madrid', zone: 'Europa', days: 8, availableSeats: 30, seatsConfirmed: true, bookingUrl: 'https://www.megatravel.pe/', descriptionUrl: 'https://cafe.megatravel.pe/' },
    origin: 'Lima', departures: [{ date: '2035-11-21', price: 2000 }],
  })
  const minimalConfig = { ...gmail, user: 'minimos@example.test', live: { ...live.live, mtpes: ['20142'] } }
  await payload.db.updateOne({ collection: 'departures', id: minimalProgram.created[0].id, req, data: { seatsReconciledAt: '2026-11-01T00:00:00Z' } })
  const minimalBalance = async () => (await payload.findByID({ collection: 'departures', id: minimalProgram.created[0].id, req })).availableSeats
  const minimal = (reference = '', quantity = '3', status = 'A petición', extra = '') => `MTPE: 20142\n${reference ? `Localizador: ${reference}\n` : ''}Cantidad: ${quantity}\nEstado: ${status}\n${extra}`
  messages.clear(); let minimalUid = 0
  const readMinimal = async (text: string, messageId = `minimal-${minimalUid + 1}`) => {
    messages.set(++minimalUid, Buffer.concat([Buffer.from(`Message-ID: <${messageId}@example.test>\r\n`), signed(text)]))
    await syncGmailMailbox(payload, minimalConfig, factory)
    return (await payload.find({ collection: 'seat-mail-events', req, sort: '-id', limit: 1 })).docs[0]
  }
  await readMinimal(minimal('A')); assert.equal(await minimalBalance(), 27)
  await readMinimal(minimal('A', '3', 'Reserva')); assert.equal(await minimalBalance(), 27)
  await readMinimal(minimal('A', '5', 'Pendiente de confirmar')); assert.equal(await minimalBalance(), 25)
  await readMinimal(minimal('A', '2', 'Reserva')); assert.equal(await minimalBalance(), 28)
  const mismatch = await readMinimal(minimal('A', '1', 'Anulado'))
  assert.equal(mismatch.observation, 'blocked'); assert.match(mismatch.reason, /cantidad/); assert.equal(await minimalBalance(), 28)
  await readMinimal(minimal('A', '2', 'Cancelado')); assert.equal(await minimalBalance(), 30)
  await readMinimal(minimal('A', '2', 'Anulado')); assert.equal(await minimalBalance(), 30)
  await readMinimal(minimal('A', '2', 'Reserva')); assert.equal(await minimalBalance(), 28)
  await readMinimal(minimal('A', '0', 'Cancelado')); assert.equal(await minimalBalance(), 30)
  await readMinimal(minimal('A', '2', 'Anulado')); assert.equal(await minimalBalance(), 30)
  assert.equal((await readMinimal(minimal('UNKNOWN', '2', 'Cancelado'))).outcome, 'review')
  assert.equal((await readMinimal(minimal('', '2', 'Anulado'))).outcome, 'review')
  assert.equal(await minimalBalance(), 30); checks++
  const warning = await readMinimal(minimal('', '2'), 'without-id-1')
  assert.equal(warning.observation, 'warning'); assert.equal(warning.outcome, 'proposed'); assert.equal(warning.delta, -2)
  await readMinimal(minimal('', '2'), 'without-id-2'); assert.equal(await minimalBalance(), 26)
  await readMinimal(minimal('', '2'), 'without-id-2'); assert.equal(await minimalBalance(), 26)
  await readMinimal(minimal('B', '2')); await readMinimal(minimal('C', '2')); assert.equal(await minimalBalance(), 22)
  const missing = await readMinimal(minimal('MISSING', '', 'Reserva') + '\nPasajero: PRIVATE-PASSENGER')
  assert.equal(missing.mtpe, '20142'); assert.equal(missing.reservation, 'MISSING'); assert.equal(missing.status, 'confirmed')
  assert.equal(missing.sender, 'reservas@example.test'); assert.equal(missing.subject, 'Fwd: Aviso privado')
  assert.equal(missing.receivedAt, '2026-11-11T15:00:00.000Z'); assert.equal(missing.observation, 'blocked')
  await readMinimal(minimal('DATE', '2', 'Reserva', 'Salida: 2035-11-22'))
  await readMinimal(minimal('MISSING-MTPE', '2').replace('20142', '99999'))
  await readMinimal(minimal('TOO-MANY', '99'))
  assert.equal(await minimalBalance(), 22); checks++
  validity = 125n // Replaying minimal, unversioned mail uses persistent Message-ID.
  await syncGmailMailbox(payload, minimalConfig, factory); assert.equal(await minimalBalance(), 22)
  assert.doesNotMatch(JSON.stringify((await payload.find({ collection: 'seat-mail-events', req, pagination: false })).docs), /PRIVATE-PASSENGER/); checks++

  const subjectOnly = await normalizeGmailMessage(Buffer.from('From: reservas@example.test\r\nSubject: MTPE: 20142 | Localizador: SUBJECT1 | Cantidad: 2 | Estado: Reserva\r\n\r\n'), gmail.senders)
  assert.equal(subjectOnly.extraction.event?.reservation, 'SUBJECT1')
  const attached = Buffer.from(`From: reservas@example.test\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="fwd"\r\n\r\n--fwd\r\nContent-Type: message/rfc822\r\n\r\n${mime(minimal('ATTACHED')).toString()}\r\n--fwd--`)
  assert.equal((await normalizeGmailMessage(attached, gmail.senders)).extraction.event?.reservation, 'ATTACHED')
  const conflict = await normalizeGmailMessage(multi(minimal('CONFLICT', '2'), `<p>${minimal('CONFLICT', '3').replaceAll('\n', '<br>')}</p>`), gmail.senders)
  assert.match(conflict.reviewReason!, /no identifican/); assert.equal(conflict.extraction.fields.reservation, 'CONFLICT'); checks++

  const { processPilotMail } = await import('../src/server/mail-pilot-service')
  const concurrentMinimal = await Promise.all(['RACE1', 'RACE2'].map(async reference => processPilotMail(await createLocalReq({}, payload), {
    id: reference, mailbox: 'minimal-race', trusted: true, receivedAt: '2026-11-11T15:00:00Z', body: minimal(reference, '14', 'Reserva'),
  }, minimalConfig.live)))
  assert.equal(concurrentMinimal.filter(event => event.outcome === 'proposed').length, 1)
  assert.equal(concurrentMinimal.filter(event => event.outcome === 'review').length, 1)
  assert.equal(await minimalBalance(), 8); checks++

  process.env.SEAT_MAIL_PILOT_ENABLED = 'false'; process.env.SEAT_MAIL_PROVIDER = 'unsupported'
  process.env.SEAT_MAIL_MODE = 'simulation'
  assert.equal((await runMailPilot(payload)).status, 'disabled')
  process.env.SEAT_MAIL_PILOT_ENABLED = 'true'
  await assert.rejects(runMailPilot(payload), /SEAT_MAIL_PROVIDER/); checks++
  process.env.SEAT_MAIL_PROVIDER = 'gmail-imap'; process.env.SEAT_MAIL_MODE = 'live'
  delete process.env.SEAT_MAIL_LIVE_FROM
  await assert.rejects(runMailPilot(payload), /SEAT_MAIL_LIVE_FROM/); checks++
  console.log(`${checks} comprobaciones Gmail correctas: simulación, cupos reales, autenticación, reenvíos, concurrencia, privacidad y reversión.`)
} finally { await payload.destroy() }
