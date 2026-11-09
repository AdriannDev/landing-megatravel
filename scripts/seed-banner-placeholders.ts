import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getPayload } from 'payload'
import sharp from 'sharp'
import config from '../src/payload.config'

type Artwork = {
  key: string
  source: string
  filename: string
  width: number
  height: number
  alt: string
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = path.resolve(root, process.env.BANNER_PLACEHOLDER_SOURCE_DIR || 'assets/banner-placeholders')
const source = (name: string) => path.join(sourceDirectory, name)

const artworks: Artwork[] = [
  { key: 'hero-01-desktop', source: source('placeholder-hero-01-1600x300.webp'), filename: 'placeholder-hero-01-1600x300.webp', width: 1600, height: 300, alt: 'Placeholder carrusel hero 01 (1600 × 300 px)' },
  { key: 'hero-01-mobile', source: source('placeholder-hero-01-mobile-800x800.webp'), filename: 'placeholder-hero-01-mobile-800x800.webp', width: 800, height: 800, alt: 'Placeholder carrusel hero 01 para móvil (800 × 800 px)' },
  { key: 'hero-02-desktop', source: source('placeholder-hero-02-1600x300.webp'), filename: 'placeholder-hero-02-1600x300.webp', width: 1600, height: 300, alt: 'Placeholder carrusel hero 02 (1600 × 300 px)' },
  { key: 'hero-02-mobile', source: source('placeholder-hero-02-mobile-800x800.webp'), filename: 'placeholder-hero-02-mobile-800x800.webp', width: 800, height: 800, alt: 'Placeholder carrusel hero 02 para móvil (800 × 800 px)' },
  { key: 'between-desktop', source: source('placeholder-rompetrafico-1200x130.webp'), filename: 'placeholder-rompetrafico-1200x130.webp', width: 1200, height: 130, alt: 'Placeholder rompetráfico (1200 × 130 px)' },
  { key: 'between-mobile', source: source('placeholder-rompetrafico-mobile-800x260.webp'), filename: 'placeholder-rompetrafico-mobile-800x260.webp', width: 800, height: 260, alt: 'Placeholder rompetráfico para móvil (800 × 260 px)' },
  { key: 'catalog-rect-desktop', source: source('placeholder-final-rectangular-900x640.webp'), filename: 'placeholder-final-rectangular-900x640.webp', width: 900, height: 640, alt: 'Placeholder promoción final rectangular (900 × 640 px)' },
  { key: 'catalog-rect-mobile', source: source('placeholder-final-rectangular-mobile-800x800.webp'), filename: 'placeholder-final-rectangular-mobile-800x800.webp', width: 800, height: 800, alt: 'Placeholder promoción final rectangular para móvil (800 × 800 px)' },
  { key: 'catalog-square-desktop', source: source('placeholder-final-cuadrado-640x640.webp'), filename: 'placeholder-final-cuadrado-640x640.webp', width: 640, height: 640, alt: 'Placeholder promoción final cuadrada (640 × 640 px)' },
  { key: 'catalog-square-mobile', source: source('placeholder-final-cuadrado-mobile-800x800.webp'), filename: 'placeholder-final-cuadrado-mobile-800x800.webp', width: 800, height: 800, alt: 'Placeholder promoción final cuadrada para móvil (800 × 800 px)' },
]

async function compose(artwork: Artwork) {
  await access(artwork.source)
  const metadata = await sharp(artwork.source).metadata()
  if (metadata.width !== artwork.width || metadata.height !== artwork.height || metadata.format !== 'webp') {
    throw new Error(`El asset ${artwork.filename} no respeta el formato esperado.`)
  }
  return artwork.source
}

async function upsertMedia(payload: Awaited<ReturnType<typeof getPayload>>, artwork: Artwork, file: string) {
  const sourceUrl = `placeholder://megatravel/${artwork.filename}`
  const existing = await payload.find({ collection: 'media', overrideAccess: true, depth: 0, limit: 1, where: { sourceUrl: { equals: sourceUrl } } })
  if (existing.docs[0]) return existing.docs[0]
  const previousHeroSourceUrl = artwork.key.endsWith('-desktop') && artwork.key.startsWith('hero-')
    ? `placeholder://megatravel/${artwork.filename.replace('1600x300', '1600x600')}`
    : null
  if (previousHeroSourceUrl) {
    const previous = await payload.find({ collection: 'media', overrideAccess: true, depth: 0, limit: 1, where: { sourceUrl: { equals: previousHeroSourceUrl } } })
    if (previous.docs[0]) {
      const data = await readFile(file)
      return payload.update({ collection: 'media', id: previous.docs[0].id, overrideAccess: true, data: { alt: artwork.alt, sourceUrl }, file: { data, size: data.length, mimetype: 'image/webp', name: artwork.filename } })
    }
  }
  const data = await readFile(file)
  return payload.create({
    collection: 'media',
    overrideAccess: true,
    data: { alt: artwork.alt, sourceUrl },
    file: { data, size: data.length, mimetype: 'image/webp', name: artwork.filename },
  })
}

function normalise(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

async function run() {
  const files = new Map<string, string>()
  for (const artwork of artworks) files.set(artwork.key, await compose(artwork))

  const payload = await getPayload({ config })
  try {
    const media = new Map<string, number>()
    for (const artwork of artworks) {
      const document = await upsertMedia(payload, artwork, files.get(artwork.key)!)
      media.set(artwork.key, Number(document.id))
    }

    const listed = await payload.find({ collection: 'banners', overrideAccess: true, depth: 0, pagination: false, sort: 'order' })
    const banners = listed.docs
    const between = banners.find(banner => banner.placement === 'between-results')
    const catalog = banners.filter(banner => banner.placement === 'catalog-end')
    const rectangular = catalog.find(banner => normalise(banner.alt).includes('rectangular')) || catalog[0]
    const square = catalog.find(banner => banner.id !== rectangular?.id && normalise(banner.alt).includes('cuadrado')) || catalog.find(banner => banner.id !== rectangular?.id)
    if (!between || !rectangular || !square) throw new Error('No se encontraron los tres banners existentes que se deben reemplazar.')

    await payload.update({ collection: 'banners', id: between.id, overrideAccess: true, data: { image: media.get('between-desktop')!, mobileImage: media.get('between-mobile')!, enabled: true, alt: 'Placeholder rompetráfico (1200 × 130 px)' } })
    await payload.update({ collection: 'banners', id: rectangular.id, overrideAccess: true, data: { image: media.get('catalog-rect-desktop')!, mobileImage: media.get('catalog-rect-mobile')!, enabled: true, alt: 'Placeholder promoción final rectangular (900 × 640 px)' } })
    await payload.update({ collection: 'banners', id: square.id, overrideAccess: true, data: { image: media.get('catalog-square-desktop')!, mobileImage: media.get('catalog-square-mobile')!, enabled: true, alt: 'Placeholder promoción final cuadrada (640 × 640 px)' } })

    for (const index of [1, 2] as const) {
      const alt = `Placeholder carrusel hero ${String(index).padStart(2, '0')} (1600 × 300 px)`
      const existing = banners.find(banner => banner.placement === 'hero' && new RegExp(`^Placeholder carrusel hero 0${index} \\(1600 × (300|600) px\\)$`).test(banner.alt))
      const data = { placement: 'hero' as const, image: media.get(`hero-0${index}-desktop`)!, mobileImage: media.get(`hero-0${index}-mobile`)!, enabled: true, order: index * 10, alt }
      if (existing) await payload.update({ collection: 'banners', id: existing.id, overrideAccess: true, data })
      else await payload.create({ collection: 'banners', overrideAccess: true, data })
    }

    console.log(JSON.stringify({ generated: artworks.map(({ filename, width, height }) => ({ filename, width, height })), updated: { between: between.id, rectangular: rectangular.id, square: square.id }, heroSlides: 2 }))
  } finally {
    await payload.destroy()
  }
}

await run()
