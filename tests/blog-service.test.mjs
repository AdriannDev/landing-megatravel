import test from 'node:test'
import assert from 'node:assert/strict'
import { BLOG_SYNC_INTERVAL_MS, isBlogSyncDue, parseMegaTravelBlog } from '../src/server/blog-service.ts'

const card = ({ id, title, category = 'NUEVO PRODUCTO', date = '07 nov, 2026', image = `https://tr2storage.blob.core.windows.net/headerimages/${id}.png` }) => `
  <a href="/es/blog/post/${id}/${title.toLowerCase().replaceAll(' ', '-')}">
    <img src="${image}" alt="">
    <span>${category}</span>
    <h3>${title}</h3>
    <span>${date}</span>
  </a>`

test('extrae tres artículos únicos de Mega Blog en el orden publicado', () => {
  const html = `<main>
    ${card({ id: '1896', title: 'Crucero por Islas Griegas' })}
    ${card({ id: '1896', title: 'Crucero por Islas Griegas' })}
    ${card({ id: '1887', title: 'Mega Balcanes', date: '03 nov, 2026' })}
    ${card({ id: '1824', title: 'Promo Asia', category: 'NOVEDADES MEGA', date: '28 oct, 2026' })}
    ${card({ id: '1788', title: 'No debe mostrarse', date: '21 oct, 2026' })}
  </main>`

  assert.deepEqual(parseMegaTravelBlog(html), [
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

test('la sincronización vence cinco días después del último éxito', () => {
  const now = new Date('2026-11-09T05:00:00.000Z')
  assert.equal(isBlogSyncDue(undefined, now), true)
  assert.equal(isBlogSyncDue('not-a-date', now), true)
  assert.equal(isBlogSyncDue(new Date(now.getTime() - BLOG_SYNC_INTERVAL_MS + 1).toISOString(), now), false)
  assert.equal(isBlogSyncDue(new Date(now.getTime() - BLOG_SYNC_INTERVAL_MS).toISOString(), now), true)
})
