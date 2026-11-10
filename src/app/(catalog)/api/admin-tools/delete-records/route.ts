import { NextResponse } from 'next/server'
import { requireEditor } from '@/server/admin-auth'
import { deletionPreview, deleteSelection } from '@/server/deletion-service'

export const dynamic = 'force-dynamic'
export async function POST(request: Request) {
  try {
    const { req } = await requireEditor(request, true)
    const body = await request.json()
    if (!['programs', 'departures'].includes(body.collection)) return NextResponse.json({ error: 'Colección no válida.' }, { status: 400 })
    const result = body.action === 'preview' ? await deletionPreview(req, body.collection, body.ids)
      : body.action === 'delete' ? await deleteSelection(req, body.collection, body.ids, body.confirmation || {}) : null
    if (!result) return NextResponse.json({ error: 'Operación no válida.' }, { status: 400 })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: (error as { status?: number }).status || 400, headers: { 'Cache-Control': 'no-store' } })
  }
}
