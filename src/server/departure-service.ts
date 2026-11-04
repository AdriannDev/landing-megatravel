import type { Payload, PayloadRequest, RequiredDataFromCollectionSlug } from 'payload'
import { isDateOnly, retirementAt } from '../lib/lifecycle.ts'
import { relationID, sharedData } from '../lib/programs.ts'
import { inTransaction } from './transactions.ts'
import { normalize } from '../lib/catalog.ts'
import { validSeatCount } from '../lib/availability.ts'

export type NewDepartureInput = {
  status?: 'draft' | 'published'
  seatsConfirmed?: boolean
  programId?: string | number
  program?: { program: string; mtpe: string; destination: string; zone: string; days: number; nights?: number | null; cruiseLine?: string; flyerSourceUrl?: string; flyer?: number | string | null; bookingUrl?: string; descriptionUrl?: string; availableSeats?: number | null; lastSeats?: boolean; seatsConfirmed?: boolean }
  origin: string
  currency?: 'USD' | 'PEN'
  priceCondition?: string
  advanceDays?: number
  priority?: number
  promotions?: (number | string)[]
  departures: { date: string; price: number; availableSeats?: number | null; lastSeats?: boolean; promotions?: (number | string)[] }[]
}

export async function createDepartures(payload: Payload, req: PayloadRequest, input: NewDepartureInput, flyerFile?: File) {
  if (!req.user || !['admin', 'editor'].includes(String(req.user.role))) throw new Error('Inicia sesión con tu cuenta de editor.')
  if (input.status && !['draft', 'published'].includes(input.status)) throw new Error('Estado de publicación no válido.')
  if (!Array.isArray(input.departures) || input.departures.length < 1 || input.departures.length > 30) throw new Error('Puedes crear entre 1 y 30 salidas por operación.')
  if (input.departures.some(row => row.availableSeats != null)) throw new Error('Los cupos se editan en el programa y se comparten entre todas sus fechas.')
  if (input.departures.some(row => row.lastSeats === true) && input.seatsConfirmed !== true) throw new Error('Confirma que verificaste las etiquetas individuales de últimos cupos.')
  if (!input.programId && input.program) {
    if (!validSeatCount(input.program.availableSeats)) throw new Error('Indica cupos enteros, mayores o iguales que cero, para el programa.')
    if ((input.program.availableSeats != null || input.program.lastSeats === true) && input.program.seatsConfirmed !== true) throw new Error('Confirma que verificaste los cupos del programa.')
  }
  if (!input.origin?.trim()) throw new Error('Indica el origen.')
  if (input.currency && !['USD', 'PEN'].includes(input.currency)) throw new Error('Moneda no válida.')
  if (input.priority != null && !Number.isFinite(input.priority)) throw new Error('Prioridad no válida.')
  if (flyerFile && (input.programId || flyerFile.size > 12 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(flyerFile.type))) throw new Error('La imagen del programa nuevo debe ser JPEG, PNG, WebP o GIF de hasta 12 MB.')
  if (flyerFile && input.program?.flyer) throw new Error('Elige una imagen existente o sube un archivo, no ambos.')
  if (input.program?.flyer && input.program.flyerSourceUrl) throw new Error('Elige una imagen existente o un enlace, no ambos.')
  if (new Set(input.departures.map(row => row.date)).size !== input.departures.length) throw new Error('Hay fechas repetidas en la solicitud.')
  for (const row of input.departures) {
    if (!isDateOnly(row.date) || !Number.isFinite(row.price) || row.price <= 0) throw new Error('Cada salida necesita una fecha válida y un precio mayor que cero.')
    if (!validSeatCount(row.availableSeats) || row.lastSeats != null && typeof row.lastSeats !== 'boolean') throw new Error('Revisa los cupos: indica sillas enteras, mayores o iguales que cero.')
    if (row.promotions !== undefined && (!Array.isArray(row.promotions) || row.promotions.some(id => (typeof id !== 'number' && typeof id !== 'string') || !String(id).trim()))) throw new Error('Selecciona promociones válidas para cada fecha.')
    retirementAt(row.date, input.advanceDays ?? 30)
  }
  if (input.promotions !== undefined && (!Array.isArray(input.promotions) || input.promotions.some(id => (typeof id !== 'number' && typeof id !== 'string') || !String(id).trim()))) throw new Error('Selecciona promociones válidas.')
  return inTransaction(req, async () => {
    const promotionIds = new Set(input.departures.flatMap(row => row.promotions ?? input.promotions ?? []).map(String))
    const resolvedPromotions = new Map<string, string | number>()
    for (const id of promotionIds) {
      try { const promotion = await payload.findByID({ collection: 'campaigns', id, req, overrideAccess: false, depth: 0 }); resolvedPromotions.set(id, promotion.id) }
      catch { throw new Error('Una promoción seleccionada no existe o no está disponible.') }
    }
    const reference = async (collection: 'origins' | 'destinations' | 'cruise-lines', name: string) => {
      if (!name?.trim()) throw new Error('Falta un dato de origen o destino.')
      const found = await payload.find({ collection, req, overrideAccess: false, depth: 0, pagination: false })
      return found.docs.find(doc => normalize(doc.name) === normalize(name)) || await payload.create({ collection, req, overrideAccess: false, data: { name: name.trim() } })
    }
    let program
    if (input.programId) program = await payload.findByID({ collection: 'programs', id: input.programId, req, overrideAccess: false, depth: 0 })
    else {
      if (!input.program) throw new Error('Selecciona un programa o completa uno nuevo.')
      if (input.program.flyer) {
        try { await payload.findByID({ collection: 'media', id: input.program.flyer, req, overrideAccess: false, depth: 0 }) }
        catch { throw new Error('La imagen seleccionada no existe o no está disponible.') }
      }
      const destination = await reference('destinations', input.program.destination)
      const cruiseLine = input.program.cruiseLine ? await reference('cruise-lines', input.program.cruiseLine) : null
      const flyer = flyerFile ? await payload.create({ collection: 'media', req, overrideAccess: false, data: { alt: `Imagen de ${input.program.program}` }, file: { data: Buffer.from(await flyerFile.arrayBuffer()), size: flyerFile.size, mimetype: flyerFile.type, name: flyerFile.name } }) : null
      program = await payload.create({ collection: 'programs', req, overrideAccess: false, data: { ...input.program, ...(flyer ? { flyer: flyer.id } : {}), destination: destination.id, cruiseLine: cruiseLine?.id || null } as RequiredDataFromCollectionSlug<'programs'> })
    }
    const origin = await reference('origins', input.origin)
    const created = []
    for (const row of input.departures) {
      const data = { ...sharedData(program), programRef: program.id, origin: origin.id, travelDate: row.date, price: row.price, lastSeats: row.lastSeats === true, currency: input.currency || 'USD', priceCondition: input.priceCondition?.trim() || 'Por persona en habitación doble', advanceDays: input.advanceDays ?? 30, priority: input.priority ?? 0, promotions: (row.promotions ?? input.promotions ?? []).map(id => resolvedPromotions.get(String(id))!), status: input.status || 'draft' }
      const doc = await payload.create({ collection: 'departures', req, overrideAccess: false, data: data as RequiredDataFromCollectionSlug<'departures'> })
      created.push({ id: doc.id, date: doc.travelDate, href: `/admin/collections/departures/${doc.id}`, preview: `/preview/${doc.id}` })
    }
    return { programId: program.id, created }
  })
}

export async function duplicateDepartures(payload: Payload, req: PayloadRequest, sourceId: string | number, rows: NewDepartureInput['departures'], seatsConfirmed = false, status: NewDepartureInput['status'] = 'draft') {
  const source = await payload.findByID({ collection: 'departures', id: sourceId, req, overrideAccess: false, depth: 1 })
  if (!source.programRef) throw new Error('Migra esta salida a Programas antes de duplicarla.')
  return createDepartures(payload, req, { status, seatsConfirmed, programId: relationID(source.programRef)!, origin: typeof source.origin === 'object' ? source.origin.name : String(source.origin), currency: source.currency, priceCondition: source.priceCondition, advanceDays: source.advanceDays, priority: source.priority || 0, promotions: (source.promotions || []).map(p => relationID(p)!), departures: rows.map(({ date, price, availableSeats, lastSeats, promotions }) => ({ date, price, availableSeats, lastSeats, promotions })) })
}
