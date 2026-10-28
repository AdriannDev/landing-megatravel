import path from 'node:path'
import sharp from 'sharp'
import { getPayload } from 'payload'
import config from '../src/payload.config'

// Local demo only. Re-running updates the same example instead of duplicating it.
if (process.env.USE_SQLITE !== 'true' || process.env.NODE_ENV === 'production') {
  throw new Error('Este ejemplo se crea únicamente en la SQLite de desarrollo local.')
}
const alt = 'Popup de ejemplo — banner gris de referencia'
const imageAlt = 'Imagen de referencia gris: tu banner aquí, 1200 × 900 px'
const imagePath = path.resolve('public/examples/popup-placeholder.png')
await sharp(path.resolve('public/examples/popup-placeholder.svg')).png().toFile(imagePath)
const payload = await getPayload({ config })
try {
  const images = await payload.find({ collection: 'media', overrideAccess: true, where: { alt: { equals: imageAlt } }, limit: 1 })
  const image = images.docs[0] || await payload.create({ collection: 'media', overrideAccess: true, data: { alt: imageAlt }, filePath: imagePath })
  const examples = await payload.find({ collection: 'banners', overrideAccess: true, where: { alt: { equals: alt } }, limit: 1 })
  const data = {
    alt, placement: 'popup' as const, title: 'Aquí irá tu próxima promoción',
    message: 'Este es un popup de ejemplo. Puedes reemplazar la imagen, agregar tu promoción o compartir una noticia desde el panel de administración.',
    image: image.id, staticImage: image.id, popupKind: 'promotion' as const,
    popupFrequency: 'always' as const, popupDelay: 1, order: -100,
    href: 'https://www.megatravel.com.pe/', buttonLabel: 'Conocer más', enabled: true,
  }
  const popup = examples.docs[0]
    ? await payload.update({ collection: 'banners', id: examples.docs[0].id, overrideAccess: true, data })
    : await payload.create({ collection: 'banners', overrideAccess: true, data })
  console.log(`Popup de ejemplo publicado en desarrollo: /admin/collections/banners/${popup.id}`)
  console.log(`Imagen: ${image.url}`)
} finally { await payload.destroy() }
