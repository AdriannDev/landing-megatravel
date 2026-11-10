import type { Payload } from 'payload'
import { isDateOnly } from '../lib/lifecycle.ts'
import { pilotMTPE } from '../lib/mail-pilot.ts'

function liveMailSettings() {
  const cutoff = process.env.SEAT_MAIL_LIVE_FROM?.trim() || ''
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(cutoff) || !isDateOnly(cutoff.slice(0, 10)) || !Number.isFinite(Date.parse(cutoff))) {
    throw new Error('Configura SEAT_MAIL_LIVE_FROM con la fecha de inicio de cupos reales y su zona horaria.')
  }
  const scope = process.env.SEAT_MAIL_LIVE_MTPES?.trim()
  const mtpes = scope ? scope.split(',').map(pilotMTPE) : []
  if (mtpes.some(mtpe => !/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(mtpe))) throw new Error('SEAT_MAIL_LIVE_MTPES debe contener códigos MTPE separados por comas.')
  return { cutoffAt: new Date(cutoff).toISOString(), mtpes }
}

export async function runMailPilot(payload: Payload) {
  if (process.env.SEAT_MAIL_PILOT_ENABLED !== 'true') return { mode: 'simulation', status: 'disabled' }
  const provider = process.env.SEAT_MAIL_PROVIDER || 'gmail-imap'
  const mode = process.env.SEAT_MAIL_MODE?.trim() || 'simulation'
  if (mode !== 'simulation' && mode !== 'live') throw new Error('SEAT_MAIL_MODE debe ser simulation o live.')
  if (mode === 'live' && provider !== 'gmail-imap') throw new Error('La actualización de cupos reales está disponible con SEAT_MAIL_PROVIDER=gmail-imap.')
  if (provider === 'gmail-imap') {
    const live = mode === 'live' ? liveMailSettings() : undefined
    const { gmailMailConfig, syncGmailMailbox } = await import('./gmail-mail.ts')
    return syncGmailMailbox(payload, gmailMailConfig(live))
  }
  if (provider === 'microsoft-graph') return (await import('./microsoft-mail.ts')).syncMicrosoftMailbox(payload)
  throw new Error('SEAT_MAIL_PROVIDER no válido. Usa gmail-imap o microsoft-graph.')
}
