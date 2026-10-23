import { NextResponse } from 'next/server'
import { getCMS } from '@/server/payload'
export const dynamic = 'force-dynamic'
export async function GET() {
  if (process.env.CATALOG_SOURCE === 'workbook') return NextResponse.json({ status: 'ok', mode: 'workbook' }, { headers: { 'Cache-Control': 'no-store' } })
  try { const payload = await getCMS(); await payload.count({ collection: 'departures', overrideAccess: true }); return NextResponse.json({ status: 'ok', mode: 'cms' }, { headers: { 'Cache-Control': 'no-store' } }) }
  catch { return NextResponse.json({ status: 'unavailable' }, { status: 503 }) }
}
