import { NextResponse } from 'next/server'
import { getPublicCatalog } from '@/server/catalog-service'
export const dynamic = 'force-dynamic'
export async function GET() {
  try { return NextResponse.json(await getPublicCatalog(), { headers: { 'Cache-Control': 'no-store, max-age=0' } }) }
  catch (error) { console.error('catalog_unavailable', error); return NextResponse.json({ error: 'Catálogo temporalmente no disponible.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }) }
}
