import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCMS } from '@/server/payload'
import { retireExpired } from '@/server/retire-service'
export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 32) return NextResponse.json({ error: 'Tarea no configurada.' }, { status: 503 })
  const received = Buffer.from(request.headers.get('authorization') || ''), expected = Buffer.from(`Bearer ${secret}`)
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  try { const result = await retireExpired(await getCMS()); return NextResponse.json(result, { status: result.errors ? 500 : 200, headers: { 'Cache-Control': 'no-store' } }) }
  catch (error) { console.error('retirement_job_failed', error); return NextResponse.json({ error: 'No se pudo ejecutar la tarea.' }, { status: 500 }) }
}
