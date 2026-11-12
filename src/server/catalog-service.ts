import 'server-only'
import snapshot from '@/data/catalog.json'
import type { Banner, BlogPost, CatalogData, Departure, Promotion } from '@/lib/types'
import { publishedPackages } from '@/lib/catalog'
import { isActivePeriod } from '@/lib/lifecycle'
import { cmsToDeparture, mediaUrl } from './normalize'
import { getCMS } from './payload'
import { DEFAULT_CONTACT_URL, DEFAULT_CONTACT_LABEL } from '@/lib/brand-config'
import { hasPublishablePopupContent } from '@/lib/popup'
import { relationID } from '@/lib/programs'

export async function getPublicCatalog(): Promise<CatalogData> {
  const now = new Date()
  const workbookMode = process.env.CATALOG_SOURCE === 'workbook' || (process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL && process.env.USE_SQLITE !== 'true')
  if (workbookMode) {
    const packages = publishedPackages(snapshot.packages as Departure[], now)
    return { packages, featuredPackageIds: [], promotions: [...new Map(packages.flatMap(p => p.promotions).map(p => [p.id, p])).values()], banners: [], blogPosts: [], contactUrl: DEFAULT_CONTACT_URL, contactLabel: DEFAULT_CONTACT_LABEL }
  }
  const payload = await getCMS()
  const [departures, campaigns, banners, settings] = await Promise.all([
    payload.find({ collection: 'departures', overrideAccess: true, depth: 2, pagination: false, where: { and: [{ status: { equals: 'published' } }, { withdrawalAt: { greater_than: now.toISOString() } }] } }),
    payload.find({ collection: 'campaigns', overrideAccess: true, depth: 0, pagination: false }),
    payload.find({ collection: 'banners', overrideAccess: true, depth: 1, pagination: false, sort: 'order', where: { enabled: { equals: true } } }),
    payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 1 }),
  ])
  const packages = publishedPackages(departures.docs.map(cmsToDeparture), now, settings.seatsValidityHours ?? undefined)
  const publicIds = new Set(packages.map(item => item.id))
  const featuredPackageIds = [...new Set([settings.featuredDeparture1, settings.featuredDeparture2].flatMap(value => {
    const doc = departures.docs.find(item => String(item.id) === String(relationID(value)))
    const id = doc && String(doc.stableId || doc.id)
    return id && publicIds.has(id) ? [id] : []
  }))]
  const promotions: Promotion[] = campaigns.docs.filter(p => isActivePeriod(p, now)).map(p => ({ id: String(p.slug || p.id), name: p.name, label: p.label }))
  const publicBanners: Banner[] = banners.docs.filter(p => isActivePeriod(p, now) && (p.placement === 'popup' ? hasPublishablePopupContent({ popupFormat: p.popupFormat, title: p.title, imageUrl: mediaUrl(p.image) }) && (!p.image || !!mediaUrl(p.image)) : !!mediaUrl(p.image))).map(p => ({ id: String(p.id), placement: p.placement || 'hero', order: p.order || 0, startsAt: p.startsAt, endsAt: p.endsAt, imageUrl: mediaUrl(p.image), staticUrl: mediaUrl(p.staticImage), mobileUrl: mediaUrl(p.mobileImage) || null, alt: p.alt, href: p.href || null, title: p.title, message: p.message, buttonLabel: p.buttonLabel, popupFormat: p.popupFormat, popupLabel: p.popupLabel, popupSecondaryLabel: p.popupSecondaryLabel, popupKind: p.popupKind, popupFrequency: p.popupFrequency, popupDelay: p.popupDelay, countdownEnabled: p.countdownEnabled === true, countdownEndsAt: p.countdownEndsAt || null }))
  const blogPosts: BlogPost[] = (settings.blogPosts || []).flatMap(post => {
    const sourceId = String(post.sourceId || '').trim()
    const title = String(post.title || '').trim()
    const href = String(post.href || '').trim()
    const imageUrl = mediaUrl(post.image) || String(post.imageUrl || '').trim()
    if (!sourceId || !title || !href || !imageUrl) return []
    return [{ sourceId, title, href, imageUrl, category: String(post.category || 'Mega Blog').trim() || 'Mega Blog', dateLabel: String(post.dateLabel || '').trim() }]
  }).slice(0, 6)
  return { packages, featuredPackageIds, promotions, banners: publicBanners, blogPosts, contactUrl: settings.contactUrl || DEFAULT_CONTACT_URL, contactLabel: settings.contactLabel || DEFAULT_CONTACT_LABEL }
}
