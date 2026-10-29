import type { Payload, PayloadRequest } from 'payload'
import { seatsValidityHours } from '../lib/availability.ts'
import { DEFAULT_CONTACT_URL } from '../lib/brand-config.ts'

// Only these public settings may be returned to editors or the catalog.
export async function getSeatSettings(payload: Payload, req?: PayloadRequest) {
  const settings = await payload.findGlobal({ slug: 'settings', req, overrideAccess: true, depth: 0, select: { seatsValidityHours: true, contactUrl: true } })
  return { validityHours: seatsValidityHours(settings.seatsValidityHours), contactUrl: settings.contactUrl || DEFAULT_CONTACT_URL }
}
