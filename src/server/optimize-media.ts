import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { APIError, type CollectionBeforeOperationHook } from 'payload'

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
const MAX_PIXELS = 40_000_000
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const supportedFormats: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

// The hook runs before Payload generates file metadata and the storage adapter uploads it.
// GIFs and animated WebP are intentionally left to Payload's normal upload handling.
export const optimizeMedia: CollectionBeforeOperationHook = async ({ operation, req, overrideAccess }) => {
  const file = req.file
  if (!['create', 'update'].includes(operation) || !file) return
  // beforeOperation runs before Payload's access check. Avoid processing unauthorized uploads.
  if (!overrideAccess && (!req.user || !['admin', 'editor'].includes(String(req.user.role)))) return
  if (file.size > MAX_UPLOAD_BYTES || !supportedExtensions.has(path.extname(file.name).toLowerCase()) || !Object.values(supportedFormats).includes(file.mimetype)) return

  try {
    const input = file.tempFilePath ? await readFile(file.tempFilePath) : file.data
    if (!input?.length || input.length > MAX_UPLOAD_BYTES) return
    const source = sharp(input, { animated: true, limitInputPixels: MAX_PIXELS })
    const metadata = await source.metadata()
    // Let Payload validate mismatched or unsupported input rather than changing its identity.
    if (!metadata.format || supportedFormats[metadata.format] !== file.mimetype || (metadata.pages || 1) > 1) return
    const optimized = await source.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86, effort: 4 }).toBuffer()
    // Do not increase storage or alter files that are already smaller than the WebP result.
    if (optimized.length >= input.length) return
    if (file.tempFilePath) await writeFile(file.tempFilePath, optimized)
    req.file = { ...file, data: file.tempFilePath ? Buffer.alloc(0) : optimized, size: optimized.length, mimetype: 'image/webp', name: `${path.parse(file.name).name}.webp` }
  } catch {
    throw new APIError('No se pudo optimizar la imagen. Comprueba que el archivo sea válido y no supere 40 megapíxeles.', 400)
  }
}
