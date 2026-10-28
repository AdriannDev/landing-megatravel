import { NextResponse } from 'next/server'
import { requireEditor, AdminError } from '@/server/admin-auth'
import { importCSV } from '@/server/import-service'
import { serializeCSV } from '@/lib/csv'
import { cmsToDeparture, mediaUrl } from '@/server/normalize'
import { importRemoteMedia } from '@/server/media-import'
import { isDateOnly } from '@/lib/lifecycle'
import { createDepartures, duplicateDepartures } from '@/server/departure-service'
import { resolveProgram } from '@/lib/programs'

export const dynamic = 'force-dynamic'
type Context = { params: Promise<{ action: string }> }
const failure = (error: unknown) => NextResponse.json({ error: (error as Error).message || 'No se pudo completar la operación.' }, { status: error instanceof AdminError ? error.status : 400, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request: Request, context: Context) {
  try {
    const { payload, req } = await requireEditor(request)
    const { action } = await context.params
    if (action === 'programs') {
      const programs = await payload.find({ collection: 'programs', req, overrideAccess: false, depth: 0, pagination: false, sort: 'program' })
      return NextResponse.json({ programs: programs.docs.map(p => ({ id: p.id, program: p.program, mtpe: p.mtpe })) }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (action !== 'options' && action !== 'export') throw new AdminError('Operación no encontrada.', 404)
    const docs = await payload.find({ collection: 'departures', req, overrideAccess: false, depth: 1, pagination: false, sort: 'program' })
    if (action === 'options') return NextResponse.json({ departures: docs.docs.map(doc => ({ id: doc.id, program: doc.program, mtpe: doc.mtpe, price: doc.price, date: doc.travelDate, flyerUrl: mediaUrl(doc.flyer) || doc.flyerSourceUrl, status: doc.status })) }, { headers: { 'Cache-Control': 'no-store' } })
    const rows = docs.docs.map(doc => {
      const p = cmsToDeparture(doc)
      const flyerUrl = resolveProgram(doc).flyerSourceUrl || (p.flyerUrl ? new URL(p.flyerUrl, process.env.NEXT_PUBLIC_SITE_URL || request.url).toString() : '')
      return { source_key: p.sourceKey || `cms:${p.id}`, source_sheet: p.sourceSheet || '', source_ref: p.sourceRef || '', program: p.program, mtpe: p.mtpe, destination: p.destination, zone: p.zone, origin: p.origin, days: p.days, nights: p.nights, travel_date: p.travelDate, price: p.price, currency: p.currency, price_condition: p.priceCondition, flyer_url: flyerUrl, booking_url: p.bookingUrl, description_url: p.descriptionUrl, promotions: p.promotions.map(p => p.name).join('|'), cruise_line: p.cruiseLine, advance_days: p.advanceDays, status: p.status, withdrawal_reason: p.withdrawalReason, withdrawal_note: p.withdrawalNote, retired_at: p.retiredAt, source_retirement_date: p.sourceRetirementDate, source_retirement_raw: p.sourceRetirementRaw }
    })
    const headers = ['source_key', 'source_sheet', 'source_ref', 'program', 'mtpe', 'destination', 'zone', 'origin', 'days', 'nights', 'travel_date', 'price', 'currency', 'price_condition', 'flyer_url', 'booking_url', 'description_url', 'promotions', 'cruise_line', 'advance_days', 'status', 'withdrawal_reason', 'withdrawal_note', 'retired_at', 'source_retirement_date', 'source_retirement_raw']
    return new Response(serializeCSV(rows, headers), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="salidas-megatravel.csv"', 'Cache-Control': 'no-store' } })
  } catch (error) { return failure(error) }
}

export async function POST(request: Request, context: Context) {
  try {
    const { payload, req, user } = await requireEditor(request, true)
    const { action } = await context.params
    if (action === 'import') {
      if (Number(request.headers.get('content-length')) > 6 * 1024 * 1024) throw new Error('CSV mayor que 5 MB.')
      const body = await request.formData(), file = body.get('file')
      if (!(file instanceof File) || file.size > 5 * 1024 * 1024 || !file.name.toLowerCase().endsWith('.csv')) throw new Error('Selecciona un CSV de hasta 5 MB.')
      const historical = body.get('historical') === 'true'
      if (historical && user.role !== 'admin') throw new AdminError('Solo un administrador puede importar históricos incompletos.', 403)
      return NextResponse.json(await importCSV(payload, await file.text(), req, { dryRun: body.get('dryRun') !== 'false', downloadImages: body.get('downloadImages') === 'true', historical }), { headers: { 'Cache-Control': 'no-store' } })
    }
    if (action === 'create-departures') {
      if (Number(request.headers.get('content-length')) > 13 * 1024 * 1024) throw new Error('La solicitud supera el límite de 13 MB.')
      let body, flyer: File | undefined
      if (request.headers.get('content-type')?.includes('multipart/form-data')) {
        const form = await request.formData(), file = form.get('flyer')
        body = JSON.parse(String(form.get('data') || '{}'))
        if (file instanceof File && file.size) flyer = file
      } else body = await request.json()
      return NextResponse.json(await createDepartures(payload, req, body, flyer), { status: 201, headers: { 'Cache-Control': 'no-store' } })
    }
    const body = await request.json()
    if (action === 'duplicate') {
      return NextResponse.json(await duplicateDepartures(payload, req, body.sourceId, body.departures), { status: 201, headers: { 'Cache-Control': 'no-store' } })
    }
    if (action === 'images') {
      const docs = await payload.find({ collection: 'programs', overrideAccess: false, req, depth: 0, pagination: false, where: body.id ? { id: { equals: body.id } } : { and: [{ flyer: { exists: false } }, { flyerSourceUrl: { exists: true } }] } })
      const results = []
      for (const doc of docs.docs.slice(0, 50)) {
        try {
          if (!doc.flyerSourceUrl) throw new Error('Esta salida no tiene un enlace de imagen para copiar.')
          const image = await importRemoteMedia(payload, doc.flyerSourceUrl, doc.program, req)
          await payload.update({ collection: 'programs', id: doc.id, req, overrideAccess: false, data: { flyer: image.id } })
          results.push({ id: doc.id, status: 'downloaded' })
        } catch (error) { results.push({ id: doc.id, status: 'error', message: (error as Error).message }) }
      }
      return NextResponse.json({ processed: results.length, remaining: Math.max(0, docs.totalDocs - 50), results }, { headers: { 'Cache-Control': 'no-store' } })
    }
    throw new AdminError('Operación no encontrada.', 404)
  } catch (error) { return failure(error) }
}
