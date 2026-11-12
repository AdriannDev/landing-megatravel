import test from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { BLOG_SYNC_INTERVAL_MS, cacheBlogImage, isBlogSyncDue, parseMegaTravelBlog, syncMegaTravelBlog } from '../src/server/blog-service.ts'

const card = ({ id, title, category = 'NUEVO PRODUCTO', date = '07 nov, 2026', image = `https://tr2storage.blob.core.windows.net/headerimages/${id}.png` }) => `
  <a href="/es/blog/post/${id}/${title.toLowerCase().replaceAll(' ', '-')}">
    <img src="${image}" alt="">
    <span>${category}</span>
    <h3>${title}</h3>
    <span>${date}</span>
  </a>`

test('extrae seis artículos únicos de Mega Blog en el orden publicado', () => {
  const html = `<main>
    ${card({ id: '1896', title: 'Crucero por Islas Griegas' })}
    ${card({ id: '1896', title: 'Crucero por Islas Griegas' })}
    ${card({ id: '1887', title: 'Mega Balcanes', date: '03 nov, 2026' })}
    ${card({ id: '1824', title: 'Promo Asia', category: 'NOVEDADES MEGA', date: '28 oct, 2026' })}
    ${card({ id: '1788', title: 'Aprende a vender', date: '21 oct, 2026' })}
    ${card({ id: '1700', title: 'Más destinos' })}
    ${card({ id: '1600', title: 'Nuevas experiencias' })}
    ${card({ id: '1500', title: 'No debe mostrarse' })}
  </main>`

  assert.deepEqual(parseMegaTravelBlog(html).map(p => p.sourceId), ['1896', '1887', '1824', '1788', '1700', '1600'])
  assert.deepEqual(parseMegaTravelBlog(html).slice(0, 3), [
    {
      sourceId: '1896',
      href: 'https://www.megatravel.pe/es/blog/post/1896/crucero-por-islas-griegas',
      imageUrl: 'https://tr2storage.blob.core.windows.net/headerimages/1896.png',
      title: 'Crucero por Islas Griegas',
      category: 'NUEVO PRODUCTO',
      dateLabel: '07 nov, 2026',
    },
    {
      sourceId: '1887',
      href: 'https://www.megatravel.pe/es/blog/post/1887/mega-balcanes',
      imageUrl: 'https://tr2storage.blob.core.windows.net/headerimages/1887.png',
      title: 'Mega Balcanes',
      category: 'NUEVO PRODUCTO',
      dateLabel: '03 nov, 2026',
    },
    {
      sourceId: '1824',
      href: 'https://www.megatravel.pe/es/blog/post/1824/promo-asia',
      imageUrl: 'https://tr2storage.blob.core.windows.net/headerimages/1824.png',
      title: 'Promo Asia',
      category: 'NOVEDADES MEGA',
      dateLabel: '28 oct, 2026',
    },
  ])
})

test('descarta artículos con enlaces o imágenes fuera de los hosts permitidos', () => {
  const html = `${card({ id: '1896', title: 'Artículo inválido', image: 'https://example.com/image.png' })}${card({ id: '1887', title: 'Artículo válido' })}`
  assert.deepEqual(parseMegaTravelBlog(html).map(post => post.sourceId), ['1887'])
})

test('prefiere la imagen diferida publicada por Mega Blog sobre su respaldo', () => {
  const html = `<a href="/es/blog/post/1896/articulo">
    <img src="https://www.megatravel.pe/javax.faces.resource/images/no-photo-XS.jpg" data-src="https://tr2storage.blob.core.windows.net/headerimages/1896.png">
    <span>NUEVO PRODUCTO</span><h3>Artículo con imagen diferida</h3><span>07 nov, 2026</span>
  </a>`
  assert.equal(parseMegaTravelBlog(html)[0].imageUrl, 'https://tr2storage.blob.core.windows.net/headerimages/1896.png')
})

test('extrae la fecha aunque el HTML no tenga espacios entre título y fecha', () => {
  const html = '<a href="/es/blog/post/100/prueba"><img src="https://www.megatravel.pe/image.png"><span>DESTINOS</span><h3>Artículo 0</h3><span>12 nov, 2026</span></a>'
  assert.equal(parseMegaTravelBlog(html)[0].dateLabel, '12 nov, 2026')
})

test('admite artículos oficiales que no publican categoría ni fecha', () => {
  const html = '<a href="/es/blog/post/376/mega-learning"><img src="https://www.megatravel.pe/image.png"><h3>Capacitación para agencias</h3><p>Descripción del artículo.</p></a>'
  assert.equal(parseMegaTravelBlog(html)[0].dateLabel, '')
  assert.equal(parseMegaTravelBlog(html)[0].category, 'Mega Blog')
})

test('la sincronización vence cinco días después del último éxito', () => {
  const now = new Date('2026-11-09T05:00:00.000Z')
  assert.equal(isBlogSyncDue(undefined, now), true)
  assert.equal(isBlogSyncDue('not-a-date', now), true)
  assert.equal(isBlogSyncDue(new Date(now.getTime() - BLOG_SYNC_INTERVAL_MS + 1).toISOString(), now), false)
  assert.equal(isBlogSyncDue(new Date(now.getTime() - BLOG_SYNC_INTERVAL_MS).toISOString(), now), true)
})

const imageData = await sharp({ create: { width: 1800, height: 1000, channels: 3, background: '#ed7424' } }).png().toBuffer()
const sixArticles = Array.from({ length: 6 }, (_, i) => card({ id: String(100 + i), title: `Artículo ${i}` })).join('')

function fakeCMS() {
  const state = { settings: { blogPosts: [{ sourceId: 'previous' }], blogLastSyncedAt: '2026-01-01T00:00:00.000Z' }, media: [], updates: 0, downloads: 0 }
  const payload = {
    findGlobal: async () => state.settings,
    find: async ({ where }) => ({ docs: state.media.filter(doc => doc.sourceUrl === where.sourceUrl.equals) }),
    create: async ({ data, file }) => {
      const doc = { ...data, id: state.media.length + 1, url: `/media/${file.name}`, file }
      state.media.push(doc)
      return doc
    },
    updateGlobal: async ({ data }) => { state.updates++; state.settings = { ...state.settings, ...data }; return state.settings },
  }
  const fetcher = async (url, options) => {
    assert.equal(options.redirect, 'error')
    if (url.endsWith('/es/blog')) return new Response(sixArticles)
    state.downloads++
    return new Response(imageData)
  }
  return { payload, state, fetcher }
}

test('prepara seis miniaturas WebP y reutiliza las copias sin volver a descargarlas', async () => {
  const { payload, state, fetcher } = fakeCMS()
  const now = new Date('2026-11-12T10:00:00Z')
  assert.deepEqual(await syncMegaTravelBlog(payload, { fetcher, now }), { status: 'updated', posts: 6 })
  assert.equal(state.settings.blogLastSyncedAt, now.toISOString())
  assert.equal(state.settings.blogPosts.length, 6)
  assert.equal(state.settings.blogPosts.every(post => post.image != null), true)
  const metadata = await sharp(state.media[0].file.data).metadata()
  assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 960); assert.equal(metadata.height, 600)
  assert.equal(state.downloads, 6)
  assert.deepEqual(await syncMegaTravelBlog(payload, { fetcher, now }), { status: 'skipped' })
  assert.deepEqual(await syncMegaTravelBlog(payload, { fetcher, force: true, now }), { status: 'updated', posts: 6 })
  assert.equal(state.downloads, 6); assert.equal(state.media.length, 6)
})

test('conserva los artículos y la fecha anterior si falla la fuente o una imagen', async () => {
  for (const failure of ['source', 'incomplete', 'image']) {
    const { payload, state, fetcher } = fakeCMS()
    const previous = structuredClone(state.settings)
    const result = await syncMegaTravelBlog(payload, { force: true, fetcher: async (url, options) => {
      if (failure === 'source') return new Response('', { status: 503 })
      if (failure === 'incomplete') return new Response(card({ id: '100', title: 'Solo uno' }))
      if (url.includes('/headerimages/102.png')) return new Response('broken')
      return fetcher(url, options)
    } })
    assert.equal(result.status, 'failed')
    assert.deepEqual(state.settings, previous)
    assert.equal(state.updates, 0)
  }
})

test('rechaza imágenes externas, credenciales, puertos y descargas demasiado grandes', async () => {
  const { payload, state } = fakeCMS()
  for (const imageUrl of ['https://example.com/image.png', 'https://user:pass@www.megatravel.pe/image.png', 'https://www.megatravel.pe:8080/image.png']) {
    await assert.rejects(() => cacheBlogImage(payload, { title: 'Prueba', imageUrl }, async () => { throw new Error('No debe descargar') }), /autorizado/)
  }
  const post = { title: 'Prueba', imageUrl: 'https://www.megatravel.pe/image.png' }
  await assert.rejects(() => cacheBlogImage(payload, post, async () => new Response('x', { headers: { 'content-length': String(12 * 1024 * 1024 + 1) } })), /12 MB/)
  await assert.rejects(() => cacheBlogImage(payload, post, async () => new Response(new Uint8Array(12 * 1024 * 1024 + 1))), /12 MB/)
  assert.equal(state.media.length, 0)
})
