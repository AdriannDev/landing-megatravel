import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'
import { isDateOnly, retirementAt } from '../lib/lifecycle.ts'
import { relationID, sharedData } from '../lib/programs.ts'
import { inTransaction } from './transactions.ts'
import { normalize } from '../lib/catalog.ts'
import { validSeatCount } from '../lib/availability.ts'

export type NewDepartureInput = {
  programId?: string | number
  program?: { program: string; mtpe: string; destination: string; zone: string; days: number; nights?: number | null; cruiseLine?: string; flyerSourceUrl?: string; flyer?: number | string | null; bookingUrl?: string; descriptionUrl?: string }
  origin: string
  currency?: 'USD' | 'PEN'
  priceCondition?: string
  advanceDays?: number
  priority?: number
  promotions?: (number | string)[]
  departures: { date: string; price: number; availableSeats?: number | null; lastSeats?: boolean }[]
}

export async function createDepartures(payload: Payload, req: PayloadRequest, input: NewDepartureInput, flyerFile?: File) {
  if (!req.user || !['admin', 'editor'].includes(String(req.user.role))) throw new Error('Inicia sesión con tu cuenta de editor.')
  if (!Array.isArray(input.departures) || input.departures.length < 1 || input.departures.length > 30) throw new Error('Puedes crear entre 1 y 30 salidas por operación.')
  if (!input.origin?.trim()) throw new Error('Indica el origen.')
  if (input.currency && !['USD', 'PEN'].includes(input.currency)) throw new Error('Moneda no válida.')
  if (input.priority != null && !Number.isFinite(input.priority)) throw new Error('Prioridad no válida.')
  if (flyerFile && (input.programId || flyerFile.size > 12 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(flyerFile.type))) throw new Error('El flyer del programa nuevo debe ser JPEG, PNG, WebP o GIF de hasta 12 MB.')
  if (new Set(input.departures.map(row => row.date)).size !== input.departures.length) throw new Error('Hay fechas repetidas en la solicitud.')
  for (const row of input.departures) {
    if (!isDateOnly(row.date) || !Number.isFinite(row.price) || row.price <= 0) throw new Error('Cada salida necesita una fecha válida y un precio mayor que cero.')
    if (!validSeatCount(row.availableSeats) || row.lastSeats != null && typeof row.lastSeats !== 'boolean') throw new Error('Revisa los cupos: indica sillas enteras, mayores o iguales que cero.')
    retirementAt(row.date, input.advanceDays ?? 30)
  }
  return inTransaction(req, async () => {
    const reference = async (collection: 'origins' | 'destinations' | 'cruise-lines', name: string) => {
      if (!name?.trim()) throw new Error('Falta un dato de origen o destino.')
      const found = await payload.find({ collection, req, overrideAccess: false, depth: 0, pagination: false })
      return found.docs.find(doc => normalize(doc.name) === normalize(name)) || await payload.create({ collection, req, overrideAccess: false, data: { name: name.trim() } })
    }
    let program
    if (input.programId) program = await payload.findByID({ collection: 'programs', id: input.programId, req, overrideAccess: false, depth: 0 })
    else {
      if (!input.program) throw new Error('Selecciona un programa o completa uno nuevo.')
      const destination = await reference('destinations', input.program.destination)
      const cruiseLine = input.program.cruiseLine ? await reference('cruise-lines', input.program.cruiseLine) : null
      const flyer = flyerFile ? await payload.create({ collection: 'media', req, overrideAccess: false, data: { alt: `Flyer de ${input.program.program}` }, file: { data: Buffer.from(await flyerFile.arrayBuffer()), size: flyerFile.size, mimetype: flyerFile.type, name: flyerFile.name } }) : null
      program = await payload.create({ collection: 'programs', req, overrideAccess: false, data: { ...input.program, ...(flyer ? { flyer: flyer.id } : {}), destination: destination.id, cruiseLine: cruiseLine?.id || null } as RequiredDataFromCollectionSlug<'programs'> })
    }
    const origin = await reference('origins', input.origin)
    const created = []
    for (const row of input.departures) {
      const data = { ...sharedData(program), programRef: program.id, origin: origin.id, travelDate: row.date, price: row.price, availableSeats: row.availableSeats ?? null, lastSeats: row.lastSeats === true, currency: input.currency || 'USD', priceCondition: input.priceCondition?.trim() || 'Por persona en habitación doble', advanceDays: input.advanceDays ?? 30, priority: input.priority ?? 0, promotions: input.promotions || [], status: 'draft' as const }
      const doc = await payload.create({ collection: 'departures', req, overrideAccess: false, data: data as RequiredDataFromCollectionSlug<'departures'> })
      created.push({ id: doc.id, date: doc.travelDate, href: `/admin/collections/departures/${doc.id}`, preview: `/preview/${doc.id}` })
    }
    return { programId: program.id, created }
  })
}

export async function duplicateDepartures(payload: Payload, req: PayloadRequest, sourceId: string | number, rows: NewDepartureInput['departures']) {
  const source = await payload.findByID({ collection: 'departures', id: sourceId, req, overrideAccess: false, depth: 1 })
  if (!source.programRef) throw new Error('Migra esta salida a Programas antes de duplicarla.')
  return createDepartures(payload, req, { programId: relationID(source.programRef)!, origin: typeof source.origin === 'object' ? source.origin.name : String(source.origin), currency: source.currency, priceCondition: source.priceCondition, advanceDays: source.advanceDays, priority: source.priority || 0, promotions: (source.promotions || []).map(p => relationID(p)!), departures: rows.map(({ date, price }) => ({ date, price })) })
}
