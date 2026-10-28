'use client'
import { CalendarDays, MapPin, Clock3, ArrowUpRight, Maximize2, FileText, Plane, ImageOff } from 'lucide-react'
import { useState } from 'react'
import type { PublicPackage } from '@/lib/types'
import { formatDate, formatMoney, titleCase } from '@/lib/catalog'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog'
import { track } from '@/lib/analytics'
import { DEFAULT_FLYER } from '@/lib/flyer'

export function PackageCard({ item, preview = false }: { item: PublicPackage; preview?: boolean }) {
  const [failedUrl, setFailedUrl] = useState('')
  const imageUrl = item.flyerUrl && failedUrl !== item.flyerUrl ? item.flyerUrl : DEFAULT_FLYER
  return <article className="package-card">
    <Dialog>
      <DialogTrigger asChild>
        <button className="flyer-button" aria-label={`Ampliar flyer de ${item.program}`}>
          <img src={imageUrl} alt={`Flyer completo de ${titleCase(item.program)}, salida ${formatDate(item.travelDate)}`} loading="lazy" width="600" height="600" onError={() => setFailedUrl(item.flyerUrl)}/>
          <span className="flyer-expand"><Maximize2 size={15}/><span>Ampliar</span></span>
        </button>
      </DialogTrigger>
      <DialogContent className="flyer-dialog">
        <DialogTitle>{titleCase(item.program)}</DialogTitle>
        <DialogDescription>MTPE {item.mtpe} · Salida {formatDate(item.travelDate)}</DialogDescription>
        <img src={imageUrl} alt={`Flyer de ${item.program}`} width="1080" height="1080" onError={() => setFailedUrl(item.flyerUrl)}/>
      </DialogContent>
    </Dialog>
    <div className="package-body">
      <div className="card-topline"><span className="region-label">{titleCase(item.zone)}</span><span className="mtpe">MTPE {item.mtpe}</span></div>
      {item.promotions.length > 0 && <div className="card-promotions">{item.promotions.map(p => <span className="promo-label" key={p.id}>{titleCase(p.label)}</span>)}</div>}
      <h3>{titleCase(item.program)}</h3>
      <div className="route"><MapPin size={14}/><span>{titleCase(item.destination)}</span><span className="route-origin"><Plane size={13}/>Desde {titleCase(item.origin)}</span></div>
      <div className="departure-meta"><span><CalendarDays size={15}/><time dateTime={item.travelDate}>{formatDate(item.travelDate)}</time></span><span><Clock3 size={15}/>{item.days} días{item.nights != null ? ` / ${item.nights} noches` : ''}</span></div>
      <div className="price-row"><div><span className="price-from">Desde</span><div className="price"><strong>{formatMoney(item.price, item.currency)}</strong><span>{item.currency}</span></div></div><span className="price-condition">{item.priceCondition}</span></div>
      {preview ? <Button disabled>Reservar en Meganet <ArrowUpRight size={16}/></Button> : <Button asChild><a href={item.bookingUrl} target="_blank" rel="noopener noreferrer" aria-label={`Reservar ${item.program} en Meganet, abre otra pestaña`} onClick={() => track('booking_click', { package_id: item.id, mtpe: item.mtpe, departure_date: item.travelDate })}>Reservar en Meganet <ArrowUpRight size={16}/></a></Button>}
      {!preview && <a className="description-link" href={item.descriptionUrl} target="_blank" rel="noopener noreferrer" aria-label={`Ver descriptivo de ${item.program}, abre otra pestaña`} onClick={() => track('description_click', { package_id: item.id, mtpe: item.mtpe })}><FileText size={14}/>Ver descriptivo<ArrowUpRight size={13}/></a>}
    </div>
  </article>
}
