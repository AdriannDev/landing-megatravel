import { load } from 'cheerio'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import type { BlogPost } from '@/lib/types'

export const MEGA_TRAVEL_BLOG_URL = 'https://www.megatravel.pe/es/blog'
export const BLOG_SYNC_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000
export const BLOG_POST_LIMIT = 6

const articlePath = /^\/es\/blog\/post\/(\d+)(?:\/|$)/
const publishedDate = /\b\d{1,2}\s+(?:ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?\s*,\s*\d{4}\b/i
const articleHost = 'www.megatravel.pe'
const imageHosts = new Set([articleHost, 'tr2storage.blob.core.windows.net'])

type SyncStatus = 'skipped' | 'updated' | 'failed'
export type BlogSyncResult = { status: SyncStatus; posts?: number; error?: string }

const clean = (value: string) => value.replace(/\s+/g, ' ').trim()

function toSafeUrl(value: string | undefined, allowedHosts: Set<string>) {
  if (!value) return null
  try {
    const url = new URL(value, MEGA_TRAVEL_BLOG_URL)
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname) || url.port || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

function articleDetails(value: string | undefined) {
  const href = toSafeUrl(value, new Set([articleHost]))
  if (!href) return null
  const match = new URL(href).pathname.match(articlePath)
  return match ? { href, sourceId: match[1] } : null
}

export function parseMegaTravelBlog(html: string): BlogPost[] {
  const $ = load(html)
  const posts = new Map<string, BlogPost>()
  $('a[href]').each((_, element) => {
    if (posts.size === BLOG_POST_LIMIT) return false
    const anchor = $(element)
    const article = articleDetails(anchor.attr('href'))
    if (!article || posts.has(article.sourceId)) return

    const title = clean(anchor.find('h3, h2').first().text())
    const imageUrl = toSafeUrl(anchor.find('img').first().attr('data-src') || anchor.find('img').first().attr('src'), imageHosts)
    if (!title || !imageUrl) return

    const text = clean(anchor.text())
    const labels = anchor.find('span').toArray().map(element => clean($(element).text()))
    const dateLabel = labels.map(value => value.match(publishedDate)?.[0]).find(Boolean) || text.match(publishedDate)?.[0] || ''
    const category = labels.find(value => value && value !== title && value !== dateLabel && !publishedDate.test(value) && value.length <= 80) || 'Mega Blog'
    posts.set(article.sourceId, { ...article, title, imageUrl, dateLabel, category })
  })
  return [...posts.values()]
}

export function isBlogSyncDue(lastSyncedAt: string | null | undefined, now = new Date()) {
  const timestamp = Date.parse(lastSyncedAt || '')
  return !Number.isFinite(timestamp) || now.getTime() - timestamp >= BLOG_SYNC_INTERVAL_MS
}

export async function cacheBlogImage(payload: Payload, post: BlogPost, fetcher: typeof fetch = fetch) {
  const sourceUrl = toSafeUrl(post.imageUrl, imageHosts)
  if (!sourceUrl) throw new Error('La imagen de Mega Blog no pertenece a un origen HTTPS autorizado.')
  const existing = await payload.find({ collection: 'media', overrideAccess: true, where: { sourceUrl: { equals: sourceUrl } }, limit: 1, depth: 0 })
  if (existing.docs[0]?.url) return existing.docs[0].id

  const response = await fetcher(sourceUrl, { redirect: 'error', signal: AbortSignal.timeout(10_000) })
  if (!response.ok || !response.body) throw new Error(`No se pudo descargar la imagen de Mega Blog: HTTP ${response.status}.`)
  const limit = 12 * 1024 * 1024
  if (Number(response.headers.get('content-length')) > limit) throw new Error('La imagen de Mega Blog supera 12 MB.')
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > limit) throw new Error('La imagen de Mega Blog supera 12 MB.')
    chunks.push(chunk)
  }
  const source = sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000 })
  const metadata = await source.metadata()
  if (!metadata.format || !['jpeg', 'png', 'webp', 'gif'].includes(metadata.format)) throw new Error('Formato de imagen de Mega Blog no admitido.')
  const data = await source.rotate().resize({ width: 960, height: 600, fit: 'cover', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
  const name = `megablog-${createHash('sha256').update(sourceUrl).digest('hex').slice(0, 24)}.webp`
  const file = { data, size: data.length, mimetype: 'image/webp', name }
  const saved = existing.docs[0]
    ? await payload.update({ collection: 'media', id: existing.docs[0].id, overrideAccess: true, data: { alt: post.title }, file })
    : await payload.create({ collection: 'media', overrideAccess: true, data: { alt: post.title, sourceUrl }, file })
  return saved.id
}

export async function syncMegaTravelBlog(payload: Payload, { force = false, now = new Date(), fetcher = fetch }: { force?: boolean; now?: Date; fetcher?: typeof fetch } = {}): Promise<BlogSyncResult> {
  const settings = await payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 0 })
  if (!force && !isBlogSyncDue(settings.blogLastSyncedAt, now)) return { status: 'skipped' }

  try {
    const response = await fetcher(MEGA_TRAVEL_BLOG_URL, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: 'text/html,application/xhtml+xml' },
    })
    if (!response.ok) throw new Error(`Mega Blog respondió HTTP ${response.status}.`)
    const posts = parseMegaTravelBlog(await response.text())
    if (posts.length !== BLOG_POST_LIMIT) throw new Error(`Mega Blog no expuso seis artículos válidos (se obtuvieron ${posts.length}).`)

    // Prepare all thumbnails before replacing the last successful set of articles.
    // Serial downloads keep the job within the CMS's memory and database limits.
    const preparedPosts = []
    for (const post of posts) preparedPosts.push({ ...post, image: await cacheBlogImage(payload, post, fetcher) })

    await payload.updateGlobal({ slug: 'settings', overrideAccess: true, data: { blogPosts: preparedPosts, blogLastSyncedAt: now.toISOString() } })
    return { status: 'updated', posts: posts.length }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'No se pudo actualizar Mega Blog.' }
  }
}

export async function refreshMegaTravelBlogNow(payload: Payload, req: PayloadRequest, { fetcher = fetch }: { fetcher?: typeof fetch } = {}) {
  if (req.user?.role !== 'admin') throw new APIError('Solo un administrador puede actualizar Mega Blog.', 403)
  const result = await syncMegaTravelBlog(payload, { force: true, fetcher })
  if (result.status !== 'updated') throw new APIError(result.error || 'No se pudo actualizar Mega Blog. Se conservan los artículos anteriores.', 502)
  const settings = await payload.findGlobal({ slug: 'settings', req, overrideAccess: false, depth: 0 })
  return { posts: result.posts, settings }
}
