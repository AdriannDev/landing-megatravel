'use client'
import { useEffect, useMemo, useState, useRef } from 'react'
import { Search, SlidersHorizontal, X, ArrowRight, ChevronLeft, ChevronRight, Globe2, ShieldCheck, Headphones, Sparkles, RotateCcw, Plane, ArrowUpRight } from 'lucide-react'
import type { CatalogData, CatalogFilters, PublicPackage } from '@/lib/types'
import { emptyFilters, parseFilters, serializeFilters, filterCatalog, titleCase, PAGE_SIZE } from '@/lib/catalog'
import { isPublishable } from '@/lib/lifecycle'
import { track } from '@/lib/analytics'
import { Brand } from './brand'
import { PackageCard } from './package-card'
import { CampaignBanner } from './campaign-banner'
import { CampaignPopup } from './campaign-popup'
import { bannersAt } from '@/lib/banners'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, DialogClose } from './ui/dialog'

const filterNames = { zones: 'Zona', destinations: 'Destino', origins: 'Origen', months: 'Mes de salida', programs: 'Programa', promotions: 'Promoción', cruiseLines: 'Naviera' } as const
type MultiFilter = keyof typeof filterNames
const sortedUnique = (items: string[]) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
const monthName = (value: string) => new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + '-01T12:00:00Z'))

function FilterPanel({ packages, filters, update, promotions, prefix }: { packages: PublicPackage[]; filters: CatalogFilters; update: (value: Partial<CatalogFilters>) => void; promotions: CatalogData['promotions']; prefix: string }) {
  const options: Record<MultiFilter, string[]> = {
    zones: sortedUnique(packages.map(p => p.zone)), destinations: sortedUnique(packages.map(p => p.destination)),
    origins: sortedUnique(packages.map(p => p.origin)), months: sortedUnique(packages.map(p => p.travelDate.slice(0, 7))),
    programs: sortedUnique(packages.map(p => p.program)), promotions: promotions.map(p => p.id),
    cruiseLines: sortedUnique(packages.map(p => p.cruiseLine || '')),
  }
  const label = (key: MultiFilter, value: string) => key === 'months' ? monthName(value) : key === 'promotions' ? promotions.find(p => p.id === value)?.label || value : titleCase(value)
  return <div className="filters-content">
    <div className="filter-intro"><strong><SlidersHorizontal size={17}/>Afina tu búsqueda</strong><button type="button" onClick={() => update(emptyFilters())}>Limpiar</button></div>
    <fieldset className="date-filter"><legend>Fecha de salida</legend><label htmlFor={`${prefix}-from`}>Desde</label><input id={`${prefix}-from`} type="date" value={filters.from} onChange={e => update({ from: e.target.value })}/><label htmlFor={`${prefix}-to`}>Hasta</label><input id={`${prefix}-to`} type="date" min={filters.from || undefined} value={filters.to} onChange={e => update({ to: e.target.value })}/><p>Para una fecha exacta, elige el mismo día.</p></fieldset>
    {(Object.keys(filterNames) as MultiFilter[]).filter(key => options[key].length).map(key => <details className="filter-group" key={key}>
      <summary>{filterNames[key]}{filters[key].length > 0 && <span>{filters[key].length}</span>}</summary>
      <div className={`filter-options ${options[key].length > 7 ? 'filter-options-scroll' : ''}`}>
        {options[key].map((value, index) => <label className="checkbox-label" htmlFor={`${prefix}-${key}-${index}`} key={value}><input id={`${prefix}-${key}-${index}`} type="checkbox" checked={filters[key].includes(value)} onChange={e => update({ [key]: e.target.checked ? [...filters[key], value] : filters[key].filter(v => v !== value) })}/><span>{label(key, value)}</span>{key === 'zones' && <small>{packages.filter(p => p.zone === value).length}</small>}</label>)}
      </div>
    </details>)}
  </div>
}

export function Catalog({ data, initialQuery = '' }: { data: CatalogData; initialQuery?: string }) {
  const [filters, setFilters] = useState(() => parseFilters(new URLSearchParams(initialQuery)))
  const [query, setQuery] = useState(filters.q)
  const [clock, setClock] = useState(() => Date.now())
  const resultRef = useRef<HTMLDivElement>(null)
  const lastNoResults = useRef('')
  // Refresh every 30 seconds, including shared program edits.
  const [liveData, setLiveData] = useState(data)
  useEffect(() => {
    const controller = new AbortController()
    const refresh = async () => {
      setClock(Date.now())
      try { const response = await fetch('/api/public/catalog', { cache: 'no-store', signal: controller.signal }); if (response.ok) setLiveData(await response.json()) } catch { /* Keep last successful data; retirement below still runs. */ }
    }
    const timer = setInterval(refresh, 30000)
    const visible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', visible)
    return () => { clearInterval(timer); controller.abort(); document.removeEventListener('visibilitychange', visible) }
  }, [])
  const packages = useMemo(() => liveData.packages.filter(p => isPublishable({ status: 'published', travelDate: p.travelDate, advanceDays: 0 }, new Date(clock))), [liveData.packages, clock])
  // Server always enforces actual per-departure cutoff; no private rule fields are sent to the browser.
  const result = useMemo(() => filterCatalog(packages, filters), [packages, filters])
  const heroBanners = bannersAt(liveData.banners, 'hero', new Date(clock))
  const betweenBanners = bannersAt(liveData.banners, 'between-results', new Date(clock))
  const finalBanners = bannersAt(liveData.banners, 'catalog-end', new Date(clock))
  const popup = bannersAt(liveData.banners, 'popup', new Date(clock))[0]
  useEffect(() => {
    const back = () => { const next = parseFilters(new URLSearchParams(window.location.search)); setFilters(next); setQuery(next.q) }
    // Initial filters already come from the server query; do not overwrite the first interaction.
    window.addEventListener('popstate', back)
    return () => window.removeEventListener('popstate', back)
  }, [])
  const update = (patch: Partial<CatalogFilters>, resetPage = true) => {
    const next = { ...filters, ...patch, ...(resetPage ? { page: 1 } : {}) }
    setFilters(next)
    if (patch.q !== undefined) setQuery(patch.q)
    const encoded = serializeFilters(next)
    window.history.pushState(null, '', window.location.pathname + (encoded ? '?' + encoded : '') + '#catalogo')
  }
  useEffect(() => {
    if (result.page !== filters.page) {
      const next = { ...filters, page: result.page }; setFilters(next)
      window.history.replaceState(null, '', window.location.pathname + (serializeFilters(next) ? '?' + serializeFilters(next) : '') + window.location.hash)
    }
    const key = serializeFilters(filters)
    if (result.total === 0 && key && key !== lastNoResults.current) {
      // Record search shape without sending free text, which may contain personal information.
      track('search_no_results', { query_length: filters.q.length, filters_count: Object.values(filters).filter(v => Array.isArray(v) ? v.length : false).length, from: filters.from, to: filters.to })
      lastNoResults.current = key
    }
  }, [result.page, result.total, filters])
  const active = (Object.keys(filterNames) as MultiFilter[]).flatMap(key => filters[key].map(value => ({ key, value, label: key === 'months' ? monthName(value) : key === 'promotions' ? liveData.promotions.find(p => p.id === value)?.label || value : titleCase(value) })))
  const count = active.length + Number(!!filters.from) + Number(!!filters.to) + Number(!!filters.q)
  const jump = (page: number) => { update({ page }, false); resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  return <>
    {popup && <CampaignPopup key={`${popup.id}:${popup.startsAt || ''}`} banner={popup}/>}
    <a className="skip-link" href="#catalogo">Ir al catálogo</a>
    <div className="utility-bar"><div className="container"><span><Plane size={12}/>Conectamos a tus pasajeros con el mundo</span><span>Exclusivo para agencias de viajes</span></div></div>
    <header className="site-header"><div className="container header-inner"><Brand/><nav aria-label="Navegación principal"><a className="nav-active" href="#catalogo">Catálogo de bloqueos</a><a href="https://cafe.megatravel.pe" target="_blank" rel="noopener noreferrer">Café Megatravel <ArrowUpRight size={13}/><span className="sr-only">, abre otra pestaña</span></a></nav><a className="contact-button" href={liveData.contactUrl} target="_blank" rel="noopener noreferrer"><Headphones size={17}/><span>{liveData.contactLabel}</span><ArrowUpRight size={14}/><span className="sr-only">, abre otra pestaña</span></a></div></header>
    <main>
      <section className="hero container" aria-labelledby="page-title"><div className="hero-heading"><span className="eyebrow"><span className="orange-line"/>BLOQUEOS MEGATRAVEL</span><h1 id="page-title">Grandes viajes.<br/><span>Mejores oportunidades.</span></h1><p>Encuentra la próxima experiencia de tus pasajeros.<br className="desktop-break"/> Tú eliges el destino. Nosotros conectamos el viaje.</p></div><CampaignBanner banners={heroBanners}/></section>
      <section className="search-section container" aria-label="Buscar paquetes"><form className="main-search" onSubmit={event => { event.preventDefault(); update({ q: query }); resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}><Search size={22} aria-hidden="true"/><label className="sr-only" htmlFor="package-search">Buscar por programa, destino o código MTPE</label><input id="package-search" type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="¿A dónde quieren viajar? Busca un destino, programa o MTPE"/><Button type="submit">Buscar viajes <ArrowRight size={17}/></Button></form><div className="search-assurances"><span><ShieldCheck size={15}/>Respaldo Megatravel</span><span><Globe2 size={15}/>Un mundo de posibilidades</span><span><Headphones size={15}/>Atención a tu agencia</span></div></section>
      <div className="catalog-background"><section className="container catalog-section" id="catalogo" ref={resultRef} aria-labelledby="catalog-title">
        <div className="catalog-heading"><div><span className="eyebrow">INSPIRA, COTIZA Y RESERVA</span><h2 id="catalog-title">Tu próximo destino de venta</h2><p>Una salida, una oportunidad. Encuentra la ideal para tu cliente.</p></div><span className="catalog-counter"><span/>{packages.length} salidas para descubrir</span></div>
        {liveData.promotions.length > 0 && <div className="campaign-tabs" aria-label="Filtrar por promoción"><button className={!filters.promotions.length ? 'selected' : ''} aria-pressed={!filters.promotions.length} onClick={() => update({ promotions: [] })}>Todas las salidas</button>{liveData.promotions.map(p => <button className={filters.promotions.includes(p.id) ? 'selected' : ''} aria-pressed={filters.promotions.includes(p.id)} key={p.id} onClick={() => update({ promotions: filters.promotions.includes(p.id) ? filters.promotions.filter(v => v !== p.id) : [...filters.promotions, p.id] })}><Sparkles size={14}/>{titleCase(p.label)}</button>)}</div>}
        <div className="catalog-layout"><aside className="desktop-filters" aria-label="Filtros del catálogo"><FilterPanel packages={packages} filters={filters} update={update} promotions={liveData.promotions} prefix="desktop"/></aside><div className="catalog-results">
          <div className="results-toolbar"><div><p role="status" aria-live="polite"><strong>{result.total}</strong> {result.total === 1 ? 'salida encontrada' : 'salidas encontradas'}</p><span>{result.total > 0 ? `Mostrando ${(result.page - 1) * PAGE_SIZE + 1}–${Math.min(result.page * PAGE_SIZE, result.total)}` : 'Prueba otra búsqueda'}</span></div><div className="toolbar-actions"><Dialog><DialogTrigger asChild><Button variant="outline" className="mobile-filter-button"><SlidersHorizontal size={17}/>Filtros{count > 0 && <span className="filter-count">{count}</span>}</Button></DialogTrigger><DialogContent className="mobile-filters"><DialogTitle>Filtros del catálogo</DialogTitle><DialogDescription>Combina destinos, fechas y promociones.</DialogDescription><div className="mobile-filter-scroll"><FilterPanel packages={packages} filters={filters} update={update} promotions={liveData.promotions} prefix="mobile"/></div><DialogClose asChild><Button className="view-results">Ver {result.total} resultados <ArrowRight size={17}/></Button></DialogClose></DialogContent></Dialog><label className="sort-label"><span>Ordenar por</span><select value={filters.sort} onChange={e => update({ sort: e.target.value as CatalogFilters['sort'] })} aria-label="Ordenar resultados"><option value="featured">Destacados</option><option value="date">Salida más próxima</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option><option value="duration">Menor duración</option></select></label></div></div>
          {count > 0 && <div className="active-filters" aria-label="Filtros activos">{filters.q && <button onClick={() => update({ q: '' })}>“{filters.q}”<X size={13}/><span className="sr-only">Quitar búsqueda</span></button>}{active.map(chip => <button key={`${chip.key}:${chip.value}`} onClick={() => update({ [chip.key]: filters[chip.key].filter(v => v !== chip.value) })}>{chip.label}<X size={13}/><span className="sr-only">Quitar filtro</span></button>)}{(['from', 'to'] as const).filter(key => filters[key]).map(key => <button key={key} onClick={() => update({ [key]: '' })}>{key === 'from' ? 'Desde' : 'Hasta'} {filters[key]}<X size={13}/><span className="sr-only">Quitar fecha</span></button>)}<button className="clear-all" onClick={() => update(emptyFilters())}>Limpiar filtros</button></div>}
          {filters.from && filters.to && filters.from > filters.to && <p className="date-error" role="alert">La fecha «Hasta» debe ser igual o posterior a «Desde».</p>}
          {result.items.length ? <><div className="package-grid">{result.items.slice(0, 6).map(item => <PackageCard item={item} key={item.id}/>)}</div>{result.items.length > 6 && <><CampaignBanner banners={betweenBanners} placement="between-results"/><div className="package-grid package-grid-continuation">{result.items.slice(6).map(item => <PackageCard item={item} key={item.id}/>)}</div></>}</> : <div className="empty-state"><span><Search size={32}/></span><h3>No encontramos salidas con estos filtros</h3><p>Prueba con un intervalo de fechas más amplio o elimina un destino o promoción.</p><Button variant="outline" onClick={() => update(emptyFilters())}><RotateCcw size={16}/>Limpiar filtros y explorar</Button></div>}
          {result.pages > 1 && <nav className="pagination" aria-label="Páginas del catálogo"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={result.page === 1} onClick={() => jump(result.page - 1)}><ChevronLeft size={18}/></Button>{Array.from({ length: result.pages }, (_, i) => i + 1).filter(page => page === 1 || page === result.pages || Math.abs(page - result.page) <= 1).map((page, i, list) => <span key={page}>{i > 0 && page - list[i - 1] > 1 && <span className="pagination-ellipsis">…</span>}<button aria-current={page === result.page ? 'page' : undefined} aria-label={`Página ${page}`} onClick={() => jump(page)}>{page}</button></span>)}<Button variant="outline" size="icon" aria-label="Página siguiente" disabled={result.page === result.pages} onClick={() => jump(result.page + 1)}><ChevronRight size={18}/></Button></nav>}
          <p className="catalog-note">Tarifas sujetas a disponibilidad y condiciones de cada programa. Confirma el precio vigente en Meganet antes de reservar.</p>
        </div></div>
      </section></div>
      {finalBanners.length > 0 && <div className="container final-campaign"><CampaignBanner banners={finalBanners} placement="catalog-end"/></div>}
      <section className="agency-help container"><div className="help-icon"><Headphones size={30}/></div><div><span className="eyebrow">ESTAMOS CERCA DE TU AGENCIA</span><h2>El siguiente gran viaje, lo planeamos juntos.</h2><p>Nuestro equipo comercial te acompaña en cada venta.</p></div><Button asChild variant="outline"><a href={liveData.contactUrl} target="_blank" rel="noopener noreferrer">Contactar al equipo <ArrowUpRight size={16}/><span className="sr-only">, abre otra pestaña</span></a></Button></section>
    </main>
    <footer className="site-footer"><div className="container footer-top"><Brand inverted/><p>El mundo en tus manos.<br/>El respaldo de Megatravel en cada viaje.</p><a href="https://www.megatravel.pe/es/" target="_blank" rel="noopener noreferrer">Conoce Megatravel <ArrowUpRight size={15}/><span className="sr-only">, abre otra pestaña</span></a></div><div className="container footer-bottom"><span>© {new Date().getFullYear()} Megatravel Operadora del Perú S.A.</span><a href="/admin">Acceso al equipo</a></div></footer>
  </>
}
