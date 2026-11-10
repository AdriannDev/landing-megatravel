import { NextResponse } from 'next/server'
import { AdminError, requireEditor } from '@/server/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { payload, req, user } = await requireEditor(request, true)
    const { id, action, reason, note } = await request.json()
    if (typeof id !== 'string' && typeof id !== 'number') throw new AdminError('Salida no válida.', 400)
    if (action === 'withdraw') {
      if (!['request', 'sold-out', 'price-change', 'other'].includes(reason)) throw new AdminError('Selecciona un motivo de retiro.', 400)
      if (reason === 'other' && (typeof note !== 'string' || !note.trim())) throw new AdminError('Explica el motivo del retiro.', 400)
      await payload.update({ collection: 'departures', id, req, overrideAccess: false, data: { status: 'withdrawn', withdrawalReason: reason, withdrawalNote: typeof note === 'string' ? note.trim() : '' } })
    } else if (action === 'delete') {
      if (user.role !== 'admin') throw new AdminError('Solo un administrador puede eliminar salidas.', 403)
      await payload.delete({ collection: 'departures', id, req, overrideAccess: false })
    } else throw new AdminError('Operación no válida.', 400)
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'No se pudo completar la operación.' }, { status: error instanceof AdminError ? error.status : 400, headers: { 'Cache-Control': 'no-store' } })
  }
}
