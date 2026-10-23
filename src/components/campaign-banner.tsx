'use client'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, ArrowUpRight, Plane } from 'lucide-react'
import type { Banner } from '@/lib/types'
export function CampaignBanner({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0)
  if (!banners.length) return <div className="campaign-editorial">
    <div><span className="eyebrow">TU PRÓXIMA GRAN VENTA EMPIEZA AQUÍ</span><h2>El mundo espera.<br/><span>Tus pasajeros, también.</span></h2><p>Salidas confirmadas, destinos extraordinarios.</p><a href="#catalogo">Explorar bloqueos <ArrowUpRight size={17}/></a></div>
    <div className="campaign-art" aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><span className="art-globe">MUNDO<br/><strong>MEGA</strong></span><Plane className="art-plane" size={64} strokeWidth={1.1}/><span className="art-stamp">2026<br/>2027</span></div>
  </div>
  const banner = banners[index % banners.length]
  const picture = <picture><source media="(prefers-reduced-motion: reduce)" srcSet={banner.staticUrl}/>{banner.mobileUrl && <source media="(max-width: 640px)" srcSet={banner.mobileUrl}/>}<img src={banner.imageUrl} alt={banner.alt} width="1400" height="330" fetchPriority="high" /></picture>
  return <section className="campaign-banner" aria-roledescription="carrusel" aria-label="Campañas de Megatravel">
    {banner.href ? <a href={banner.href} target="_blank" rel="noopener noreferrer" aria-label={`${banner.alt}, abre otra pestaña`}>{picture}</a> : picture}
    {banners.length > 1 && <div className="banner-controls"><button aria-label="Banner anterior" onClick={() => setIndex(i => (i - 1 + banners.length) % banners.length)}><ChevronLeft size={18}/></button><span aria-live="polite">{index + 1} / {banners.length}</span><button aria-label="Banner siguiente" onClick={() => setIndex(i => (i + 1) % banners.length)}><ChevronRight size={18}/></button></div>}
  </section>
}
