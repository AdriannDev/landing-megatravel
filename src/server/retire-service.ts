import { createLocalReq, type Payload } from 'payload'
import { isPublishable } from '../lib/lifecycle'
import { cmsToDeparture } from './normalize'
export async function retireExpired(payload: Payload, now = new Date()) {
  const req = await createLocalReq({}, payload)
  const docs = await payload.find({ collection: 'departures', overrideAccess: true, depth: 0, pagination: false, where: { status: { equals: 'published' } } })
  const results: { id: string | number; status: string; message?: string }[] = []
  for (const doc of docs.docs) {
    if (isPublishable(cmsToDeparture(doc), now)) continue
    try {
      // Re-read before updating: an editor may have extended this departure while the job was running.
      const current = await payload.findByID({ collection: 'departures', id: doc.id, depth: 0, overrideAccess: true, req })
      if (current.status !== 'published' || isPublishable(cmsToDeparture(current), now)) continue
      await payload.update({ collection: 'departures', id: doc.id, req, overrideAccess: true, context: { automaticRetirement: true }, data: { status: 'withdrawn', withdrawalReason: 'automatic', withdrawalNote: `Retiro automático: ${current.advanceDays} días antes de la salida; America/Lima.` } })
      results.push({ id: doc.id, status: 'withdrawn' })
    } catch (error) { results.push({ id: doc.id, status: 'error', message: (error as Error).message }) }
  }
  return { checked: docs.totalDocs, withdrawn: results.filter(r => r.status === 'withdrawn').length, errors: results.filter(r => r.status === 'error').length, results }
}
