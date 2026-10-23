import { Catalog } from '@/components/catalog'
import { getPublicCatalog } from '@/server/catalog-service'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [data, params] = await Promise.all([getPublicCatalog(), searchParams])
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item)
  return <Catalog data={data} initialQuery={query.toString()}/>
}
