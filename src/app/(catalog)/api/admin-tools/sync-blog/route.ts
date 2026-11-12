import { NextResponse } from 'next/server'
import { APIError } from 'payload'
import { requireEditor, AdminError } from '@/server/admin-auth'
import { refreshMegaTravelBlogNow } from '@/server/blog-service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { payload, req } = await requireEditor(request, true)
    return NextResponse.json(await refreshMegaTravelBlogNow(payload, req), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const status = error instanceof AdminError || error instanceof APIError ? error.status : 500
    const message = error instanceof Error ? error.message : 'No se pudo actualizar Mega Blog.'
    return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
