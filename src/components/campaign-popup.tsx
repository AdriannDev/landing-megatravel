'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Megaphone, Newspaper } from 'lucide-react'
import type { Banner } from '@/lib/types'
import { isActivePeriod } from '@/lib/lifecycle'
import { popupStorageKey, shouldShowPopup } from '@/lib/popup'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'

export function CampaignPopup({ banner }: { banner: Banner }) {
  const [open, setOpen] = useState(false)
  const shown = useRef(false)
  const { id, startsAt, endsAt, popupDelay, popupFrequency } = banner
  useEffect(() => {
    if (shown.current) return
    const key = popupStorageKey({ id, startsAt } as Banner)
    const storage = () => popupFrequency === 'daily' ? window.localStorage : window.sessionStorage
    try { if (!shouldShowPopup(popupFrequency, storage().getItem(key))) return } catch { /* Storage can be unavailable in private browsing. */ }
    let retry: ReturnType<typeof setTimeout>
    const show = () => {
      if (!isActivePeriod({ startsAt, endsAt })) return
      if (document.visibilityState !== 'visible' || document.querySelector('[role="dialog"]')) {
        retry = setTimeout(show, 1000)
        return
      }
      shown.current = true
      try { storage().setItem(key, String(Date.now())) } catch { /* Still show once in this mounted catalog. */ }
      setOpen(true)
    }
    const timer = setTimeout(show, Math.max(0, Math.min(60, popupDelay ?? 2)) * 1000)
    return () => { clearTimeout(timer); clearTimeout(retry) }
  }, [id, startsAt, endsAt, popupDelay, popupFrequency])
  const news = banner.popupKind === 'news'
  const Icon = news ? Newspaper : Megaphone
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className={`campaign-popup${banner.imageUrl ? ' campaign-popup-with-image' : ''}`} onOpenAutoFocus={e => {
      e.preventDefault()
      document.querySelector<HTMLButtonElement>('.campaign-popup .dialog-close')?.focus()
    }} onCloseAutoFocus={e => {
      e.preventDefault()
      document.querySelector<HTMLInputElement>('.main-search input')?.focus({ preventScroll: true })
    }}>
      <div className="popup-heading"><span><Icon size={15}/>{news ? 'Noticias Megatravel' : 'Especial para tu próxima venta'}</span></div>
      {banner.imageUrl && <picture className="popup-art">
        <source media="(prefers-reduced-motion: reduce)" srcSet={banner.staticUrl || banner.imageUrl}/>
        {banner.mobileUrl && <source media="(max-width: 640px)" srcSet={banner.mobileUrl}/>}
        <img src={banner.imageUrl} alt={banner.alt} width="1200" height="900"/>
      </picture>}
      <div className="popup-copy">
        <span className="popup-eyebrow">{news ? 'Al día contigo' : 'Oportunidades para viajar'}</span>
        <DialogTitle>{banner.title || banner.alt}</DialogTitle>
        <DialogDescription className={banner.message ? 'popup-message' : 'sr-only'}>{banner.message || 'Descubre las novedades de Megatravel para agencias de viajes.'}</DialogDescription>
        <div className="popup-actions">
          {banner.href && <a className="button button-primary" href={banner.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>{banner.buttonLabel || 'Conocer más'}<ArrowUpRight size={17}/><span className="sr-only"> (abre otra pestaña)</span></a>}
          <DialogClose className="popup-dismiss">Seguir explorando</DialogClose>
        </div>
      </div>
    </DialogContent>
  </Dialog>
}
