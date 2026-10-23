import { createLocalReq } from 'payload'
import { getCMS } from './payload'
export async function requireEditor(request: Request, mutation = false) {
  if (mutation) {
    const expected = new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin
    if (request.headers.get('origin') !== expected) throw new AdminError('Origen de solicitud no válido.', 403)
  }
  const payload = await getCMS()
  const { user } = await payload.auth({ headers: request.headers })
  if (!user || !['admin', 'editor'].includes(String(user.role))) throw new AdminError('Inicia sesión con tu cuenta de editor.', 401)
  const req = await createLocalReq({ user }, payload)
  return { payload, user, req }
}
export class AdminError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status } }
