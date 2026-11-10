import { randomUUID } from 'node:crypto'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { digest, eventKey, extractMailEvent } from '../lib/mail-pilot.ts'
import { inTransaction } from './transactions.ts'
import { lockMailPilot, processPilotMail } from './mail-pilot-service.ts'

export type GmailConfig = { user: string; password: string; folder: string; senders: string[] }
export type GmailClient = Pick<ImapFlow, 'connect' | 'mailboxOpen' | 'search' | 'fetchOne' | 'logout' | 'close' | 'on'>
export type GmailClientFactory = (config: GmailConfig) => GmailClient
const MAX_BYTES = 1_000_000
const LEASE_MS = 9 * 60_000
class GmailReaderStateError extends Error {}
export function gmailMailConfig(): GmailConfig {
  const missing = ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'SEAT_MAIL_ALLOWED_SENDERS'].filter(name => !process.env[name]?.trim())
  if (missing.length) throw new Error(`Falta configurar el piloto: ${missing.join(', ')}.`)
  const user = process.env.GMAIL_USER!.trim().toLowerCase()
  const senders = process.env.SEAT_MAIL_ALLOWED_SENDERS!.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (![user, ...senders].every(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))) throw new Error('Configura direcciones completas en GMAIL_USER y SEAT_MAIL_ALLOWED_SENDERS.')
  return { user, password: process.env.GMAIL_APP_PASSWORD!.replace(/\s/g, ''), folder: process.env.GMAIL_FOLDER?.trim() || 'INBOX', senders }
}
export const createGmailClient: GmailClientFactory = config => new ImapFlow({
  host: 'imap.gmail.com', port: 993, secure: true,
  auth: { user: config.user, pass: config.password },
  logger: false, logRaw: false, disableAutoIdle: true,
  connectionTimeout: 30_000, greetingTimeout: 30_000, socketTimeout: 30_000,
  tls: { rejectUnauthorized: true },
})

// Decode MIME only in memory. Trust the envelope sender, never a From line inside a forward.
export async function normalizeGmailMessage(source: Buffer, senders: string[]) {
  const mail = await simpleParser(source, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true })
  const addresses = mail.from?.value || []
  const trusted = addresses.length === 1 && senders.includes(addresses[0].address?.toLowerCase() || '')
  const forwarded = mail.attachments.filter(a => a.contentType === 'message/rfc822')
  if (forwarded.length) return { body: '', trusted, reviewReason: 'Reenvío como adjunto. Revisa el aviso completo y utiliza reenvío en línea.' }
  const text = mail.text || '', html = mail.html || ''
  if (text && html) {
    const a = extractMailEvent({ body: text }), b = extractMailEvent({ body: html, html: true })
    if (!a.event || !b.event || eventKey(a.event) !== eventKey(b.event))
      return { body: '', trusted, reviewReason: 'Las partes de texto y HTML no identifican un único evento coincidente.' }
  }
  return { body: html || text, html: Boolean(html), trusted }
}

export async function syncGmailMailbox(payload: Payload, config: GmailConfig = gmailMailConfig(), factory: GmailClientFactory = createGmailClient) {
  const key = digest(`gmail-imap:${config.user.toLowerCase()}:${config.folder}`), owner = randomUUID()
  const transact = async <T>(run: (req: PayloadRequest) => Promise<T>) => {
    const req = await createLocalReq({}, payload)
    return inTransaction(req, async () => { await lockMailPilot(req); return run(req) })
  }
  const claimed = await transact(async req => {
    const state = (await payload.find({ collection: 'mail-sync-cursors', req, overrideAccess: true, where: { key: { equals: key } }, limit: 1 })).docs[0]
    if (state?.leaseUntil && Date.parse(state.leaseUntil) > Date.now()) return null
    const data = { key, provider: 'gmail-imap' as const, owner, leaseUntil: new Date(Date.now() + LEASE_MS).toISOString() }
    return state ? payload.update({ collection: 'mail-sync-cursors', id: state.id, req, overrideAccess: true, data }) : payload.create({ collection: 'mail-sync-cursors', req, overrideAccess: true, data })
  })
  if (!claimed) return { mode: 'simulation', provider: 'gmail-imap', status: 'busy', processed: 0 }
  let client: GmailClient | undefined, processed = 0
  try {
    client = factory(config)
    // ImapFlow emits connection errors; never log raw server responses or message data.
    client.on('error', () => {})
    await client.connect()
    const mailbox = await client.mailboxOpen(config.folder, { readOnly: true })
    if (!mailbox.readOnly || !mailbox.uidValidity) throw new GmailReaderStateError('La carpeta debe abrirse en modo de solo lectura con UIDVALIDITY.')
    const uidValidity = String(mailbox.uidValidity)
    let lastUid = claimed.uidValidity === uidValidity ? (claimed.lastUid || 0) : 0
    // IMAP ranges can include the last message when the requested start exceeds '*'.
    const found = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true })
    const uids = [...new Set(found || [])].filter(uid => uid > lastUid).sort((a, b) => a - b).slice(0, 500)
    const currentLease = async (req: PayloadRequest) => {
      const state = await payload.findByID({ collection: 'mail-sync-cursors', id: claimed.id, req, overrideAccess: true })
      if (state.owner !== owner || !state.leaseUntil || Date.parse(state.leaseUntil) <= Date.now()) throw new GmailReaderStateError('La ejecución perdió la reserva del lector. Se retomará en la siguiente tarea.')
    }
    for (const uid of uids) {
      // PEEK from ImapFlow + EXAMINE readOnly: never set flags, move or delete.
      const message = await client.fetchOne(uid, { uid: true, size: true, source: { start: 0, maxLength: MAX_BYTES + 1 } }, { uid: true })
      let normalized
      if (!message) normalized = null // Expunged after search: not a business cancellation.
      else if (!message.source || (message.size || 0) > MAX_BYTES || message.source.length > MAX_BYTES)
        normalized = { body: '', trusted: false, reviewReason: 'Mensaje ausente o demasiado grande. Revisa el aviso completo.' }
      else {
        try { normalized = await normalizeGmailMessage(message.source, config.senders) }
        catch { normalized = { body: '', trusted: false, reviewReason: 'No se pudo interpretar el formato MIME. Revisa el aviso completo.' } }
      }
      await transact(async req => {
        await currentLease(req)
        if (normalized) await processPilotMail(req, { ...normalized, id: `${uidValidity}:${uid}`, mailbox: key })
        await payload.update({ collection: 'mail-sync-cursors', id: claimed.id, req, overrideAccess: true, data: { uidValidity, lastUid: uid, lastSuccessAt: new Date().toISOString(), leaseUntil: new Date(Date.now() + LEASE_MS).toISOString() } })
      })
      lastUid = uid
      if (normalized) processed++
    }
    if (!uids.length) await transact(async req => {
      await currentLease(req)
      await payload.update({ collection: 'mail-sync-cursors', id: claimed.id, req, overrideAccess: true, data: { uidValidity, lastUid, lastSuccessAt: new Date().toISOString() } })
    })
    return { mode: 'simulation', provider: 'gmail-imap', status: 'read', processed, pending: uids.length === 500 }
  } catch (error) {
    // Credentials, subjects, bodies and upstream diagnostic responses must never reach cron logs.
    if (error instanceof GmailReaderStateError) throw error
    throw new Error('No se completó la lectura de Gmail. Comprueba acceso IMAP, contraseña de aplicación y conexión. El progreso confirmado se conserva.')
  } finally {
    if (client) { try { await client.logout() } catch { client.close() } }
    await transact(async req => {
      const current = await payload.findByID({ collection: 'mail-sync-cursors', id: claimed.id, req, overrideAccess: true })
      if (current.owner === owner) await payload.update({ collection: 'mail-sync-cursors', id: claimed.id, req, overrideAccess: true, data: { owner: null, leaseUntil: null } })
    })
  }
}
