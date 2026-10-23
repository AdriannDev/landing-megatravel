import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getCMS } from '@/server/payload'
import { toPublicPackage } from '@/lib/catalog'
import { cmsToDeparture } from '@/server/normalize'
import { PackageCard } from '@/components/package-card'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Vista previa | Megatravel', robots: { index: false, follow: false } }
export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const payload = await getCMS(), { user } = await payload.auth({ headers: await headers() })
  if (!user || !['admin', 'editor'].includes(String(user.role))) notFound()
  const { id } = await params
  let doc
  try { doc = await payload.findByID({ collection: 'departures', id, depth: 1, overrideAccess: false, user }) } catch { notFound() }
  return <main style={{ maxWidth: 380, margin: '40px auto', padding: 20 }}><p style={{ fontSize: 13, lineHeight: 1.7 }}>Vista previa privada. Estado: {doc.status}. La publicación se gestiona en el CMS.</p><PackageCard item={toPublicPackage(cmsToDeparture(doc))} preview/><p style={{ marginTop: 20 }}><a href={`/admin/collections/departures/${doc.id}`}>← Volver a editar</a></p></main>
}
