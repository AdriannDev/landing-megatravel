import type { Payload } from 'payload'

export async function runMailPilot(payload: Payload) {
  if (process.env.SEAT_MAIL_PILOT_ENABLED !== 'true') return { mode: 'simulation', status: 'disabled' }
  const provider = process.env.SEAT_MAIL_PROVIDER || 'gmail-imap'
  if (provider === 'gmail-imap') return (await import('./gmail-mail.ts')).syncGmailMailbox(payload)
  if (provider === 'microsoft-graph') return (await import('./microsoft-mail.ts')).syncMicrosoftMailbox(payload)
  throw new Error('SEAT_MAIL_PROVIDER no válido. Usa gmail-imap o microsoft-graph.')
}
