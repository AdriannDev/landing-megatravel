import type { Payload, PayloadRequest } from 'payload'
import { safeExternalUrl } from '../lib/lifecycle.ts'
import { createHash } from 'node:crypto'

export async function importRemoteMedia(payload: Payload, sourceUrl: string, alt: string, req: PayloadRequest) {
  if (!safeExternalUrl(sourceUrl)) throw new Error('La imagen debe tener un enlace HTTPS.')
  const url = new URL(sourceUrl)
  const allowedHosts = (process.env.IMPORT_MEDIA_ALLOWED_HOSTS || 'i.imgur.com,i.spread.name').split(',').map(s => s.trim())
  if (!allowedHosts.includes(url.hostname) || url.port || url.username || url.password) throw new Error(`El host ${url.hostname} no está autorizado para descarga. Configúralo en IMPORT_MEDIA_ALLOWED_HOSTS.`)
  const existing = await payload.find({ collection: 'media', overrideAccess: false, req, where: { sourceUrl: { equals: sourceUrl } }, limit: 1, depth: 0 })
  if (existing.docs[0]) return existing.docs[0]
  // No redirect following: approved hosts cannot redirect the server into an internal service.
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' })
  if (!response.ok || !response.body) throw new Error('No se pudo descargar la imagen: HTTP ' + response.status)
  const limit = 12 * 1024 * 1024
  if (Number(response.headers.get('content-length')) > limit) throw new Error('Imagen mayor que 12 MB.')
  const chunks: Uint8Array[] = []; let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > limit) throw new Error('Imagen mayor que 12 MB.')
    chunks.push(chunk)
  }
  const data = Buffer.concat(chunks), hex = data.subarray(0, 12).toString('hex')
  const format = hex.startsWith('89504e470d0a1a0a') ? ['png', 'image/png'] : hex.startsWith('ffd8ff') ? ['jpg', 'image/jpeg'] : data.toString('ascii', 0, 3) === 'GIF' ? ['gif', 'image/gif'] : data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' ? ['webp', 'image/webp'] : null
  if (!format) throw new Error('El enlace no devuelve una imagen PNG, JPEG, GIF o WebP válida.')
  const filename = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 24) + '.' + format[0]
  return payload.create({ collection: 'media', overrideAccess: false, req, data: { alt, sourceUrl }, file: { data, size, mimetype: format[1], name: filename } })
}
