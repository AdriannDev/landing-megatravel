import { load } from 'cheerio'
import type { Payload } from 'payload'
import type { BlogPost } from '@/lib/types'

export const MEGA_TRAVEL_BLOG_URL = 'https://www.megatravel.pe/es/blog'
export const BLOG_SYNC_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000

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
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) return null
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
    if (posts.size === 3) return false
    const anchor = $(element)
    const article = articleDetails(anchor.attr('href'))
    if (!article || posts.has(article.sourceId)) return

    const title = clean(anchor.find('h3, h2').first().text())
    const imageUrl = toSafeUrl(anchor.find('img').first().attr('data-src') || anchor.find('img').first().attr('src'), imageHosts)
    if (!title || !imageUrl) return

    const text = clean(anchor.text())
    const dateLabel = text.match(publishedDate)?.[0] || ''
    const category = anchor.find('span').toArray().map(element => clean($(element).text())).find(value => value && value !== title && value !== dateLabel && !publishedDate.test(value) && value.length <= 80) || 'Mega Blog'
    posts.set(article.sourceId, { ...article, title, imageUrl, dateLabel, category })
  })
  return [...posts.values()]
}

export function isBlogSyncDue(lastSyncedAt: string | null | undefined, now = new Date()) {
  const timestamp = Date.parse(lastSyncedAt || '')
  return !Number.isFinite(timestamp) || now.getTime() - timestamp >= BLOG_SYNC_INTERVAL_MS
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
    if (posts.length !== 3) throw new Error(`Mega Blog no expuso tres artículos válidos (se obtuvieron ${posts.length}).`)

    await payload.updateGlobal({ slug: 'settings', overrideAccess: true, data: { blogPosts: posts, blogLastSyncedAt: now.toISOString() } })
    return { status: 'updated', posts: posts.length }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'No se pudo actualizar Mega Blog.' }
  }
}
