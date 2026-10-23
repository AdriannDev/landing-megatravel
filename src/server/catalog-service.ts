import 'server-only'
import snapshot from '@/data/catalog.json'
import type { Banner, CatalogData, Departure, Promotion } from '@/lib/types'
import { publishedPackages } from '@/lib/catalog'
import { isActivePeriod } from '@/lib/lifecycle'
import { cmsToDeparture, mediaUrl } from './normalize'
import { getCMS } from './payload'
import { DEFAULT_CONTACT_URL, DEFAULT_CONTACT_LABEL } from '@/lib/brand-config'

export async function getPublicCatalog(): Promise<CatalogData> {
  const now = new Date()
  const workbookMode = process.env.CATALOG_SOURCE === 'workbook' || (process.env.NODE_ENV !== 'production' && !process.env.DATABASE_URL && process.env.USE_SQLITE !== 'true')
  if (workbookMode) {
    const packages = publishedPackages(snapshot.packages as Departure[], now)
    return { packages, promotions: [...new Map(packages.flatMap(p => p.promotions).map(p => [p.id, p])).values()], banners: [], contactUrl: DEFAULT_CONTACT_URL, contactLabel: DEFAULT_CONTACT_LABEL }
  }
  const payload = await getCMS()
  const [departures, campaigns, banners, settings] = await Promise.all([
    payload.find({ collection: 'departures', overrideAccess: true, depth: 1, pagination: false, where: { and: [{ status: { equals: 'published' } }, { withdrawalAt: { greater_than: now.toISOString() } }] } }),
    payload.find({ collection: 'campaigns', overrideAccess: true, depth: 0, pagination: false }),
    payload.find({ collection: 'banners', overrideAccess: true, depth: 1, pagination: false, sort: 'order', where: { enabled: { equals: true } } }),
    payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 0 }),
  ])
  const packages = publishedPackages(departures.docs.map(cmsToDeparture), now)
  const promotions: Promotion[] = campaigns.docs.filter(p => isActivePeriod(p, now)).map(p => ({ id: String(p.slug || p.id), name: p.name, label: p.label }))
  const publicBanners: Banner[] = banners.docs.filter(p => isActivePeriod(p, now) && mediaUrl(p.image) && mediaUrl(p.staticImage)).map(p => ({ id: String(p.id), imageUrl: mediaUrl(p.image), staticUrl: mediaUrl(p.staticImage), mobileUrl: mediaUrl(p.mobileImage) || null, alt: p.alt, href: p.href || null }))
  return { packages, promotions, banners: publicBanners, contactUrl: settings.contactUrl || DEFAULT_CONTACT_URL, contactLabel: settings.contactLabel || DEFAULT_CONTACT_LABEL }
}
