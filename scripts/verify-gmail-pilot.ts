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
    async fetchOne(uid: number, query: unknown, options: unknown) {
      assert.deepEqual(query, { uid: true, size: true, source: { start: 0, maxLength: 1_000_001 } }); assert.deepEqual(options, { uid: true })
      fetched.push(uid); if (uid === failUid) throw new Error('interrupted')
      const source = messages.get(uid); return source ? { uid, source, size: source.length } : false
    },
  } as unknown as GmailClient)

  // Failure after UID 1: seen and unseen are selected alike, checkpoint survives restart.
  await assert.rejects(syncGmailMailbox(payload, gmail, factory), /progreso confirmado/)
  assert.equal((await state()).lastUid, 1); assert.equal(await balance(), 12); assert.equal((await state()).owner, null); checks++
  failUid = 0
  messages.set(3, mime(body({ Tipo: 'modificación', Sillas: '2', Versión: '2', 'Fecha del evento': '2026-11-04T12:00:00-05:00' })))
  messages.set(4, mime(body({ Tipo: 'cancelación', Estado: 'Cancelada', Sillas: '', Versión: '3', 'Fecha del evento': '2026-11-05T12:00:00-05:00' })))
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
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE-PASSENGER|private-secret|Aviso privado|Content-Type/)
  assert.equal((await payload.findByID({ collection: 'programs', id: program.programId, req })).availableSeats, 15)
  assert.equal((await payload.findByID({ collection: 'departures', id: program.created[0].id, req })).availableSeats, 15); checks++
  process.env.SEAT_MAIL_PILOT_ENABLED = 'false'; process.env.SEAT_MAIL_PROVIDER = 'unsupported'
  assert.equal((await runMailPilot(payload)).status, 'disabled')
  process.env.SEAT_MAIL_PILOT_ENABLED = 'true'
  await assert.rejects(runMailPilot(payload), /SEAT_MAIL_PROVIDER/); checks++
  console.log(`${checks} comprobaciones Gmail correctas: reenvíos, UID, reinicios, concurrencia, rollback, privacidad y cupos públicos intactos.`)
} finally { await payload.destroy() }
