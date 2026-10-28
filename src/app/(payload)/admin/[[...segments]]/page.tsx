import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'
import { redirect } from 'next/navigation'
import { departureViewURL } from '@/lib/admin-views'
type Args = { params: Promise<{ segments: string[] }>; searchParams: Promise<{ [key: string]: string | string[] }> }
export const generateMetadata = (args: Args) => generatePageMetadata({ config, ...args })
export default async function Page(args: Args) {
  const { segments = [] } = await args.params
  if (segments[0] === 'collections' && segments[1] === 'departures') {
    if (segments[2] === 'create') redirect('/admin/new-departure')
    if (segments.length === 2 && !(await args.searchParams).mtView) {
      const existing = await args.searchParams
      const url = new URL(departureViewURL('published'), 'http://localhost')
      for (const [key, value] of Object.entries(existing)) {
        if (key.startsWith('where')) continue
        url.searchParams.delete(key)
        for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, item)
      }
      redirect(url.pathname + url.search)
    }
  }
  return RootPage({ config, importMap, ...args })
}
