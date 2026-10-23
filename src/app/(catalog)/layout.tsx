import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
export const metadata: Metadata = {
  title: 'Bloqueos Megatravel | Grandes viajes, mejores oportunidades',
  description: 'Encuentra salidas de Megatravel por destino, fecha y código MTPE. Catálogo de bloqueos para agencias de viajes del Perú.',
  robots: { index: true, follow: true },
  icons: { icon: '/icon.svg' },
}
export default function Layout({ children }: { children: React.ReactNode }) {
  const ga = process.env.NEXT_PUBLIC_GA4_ID
  return <html lang="es-PE"><body>{children}{ga && /^G-[A-Z0-9]+$/.test(ga) && <><Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive"/><Script id="ga4" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}');`}</Script></>}</body></html>
}
