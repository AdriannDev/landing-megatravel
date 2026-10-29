'use client'
import { useFormFields } from '@payloadcms/ui'
import { useEffect, useMemo, useState } from 'react'
import { retirementAt, isActivePeriod } from '@/lib/lifecycle'
import { formatDate, formatMoney, titleCase } from '@/lib/catalog'
import { DEFAULT_FLYER } from '@/lib/flyer'
import { DEFAULT_CONTACT_URL } from '@/lib/brand-config'
import { DEFAULT_SEATS_VALIDITY_HOURS, prepareSeatReference, publicAvailability } from '@/lib/availability'
import { LastSeatsBadge, SeatAvailability, useSeatAvailability } from '../seat-availability'
import { PromotionLabels } from '../promotion-labels'
import type { Promotion } from '@/lib/types'
const previewKeys = ['programRef', 'program', 'mtpe', 'origin', 'travelDate', 'days', 'nights', 'price', 'currency', 'priceCondition', 'flyerSourceUrl', 'flyer', 'availableSeats', 'lastSeats', 'seatsCheckedAt', 'seatsConfirmed', 'promotions']
export function CardPreview() {
  const { formValues, initialValues } = useFormFields(([fields]) => ({ formValues: Object.fromEntries(previewKeys.map(key => [key, fields[key]?.value])), initialValues: Object.fromEntries(previewKeys.map(key => [key, fields[key]?.initialValue])) }))
  const [settings, setSettings] = useState({ validityHours: DEFAULT_SEATS_VALIDITY_HOURS, contactUrl: DEFAULT_CONTACT_URL })
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/admin-tools/availability-settings', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => { if (data) setSettings(data) }).catch(() => {})
    return () => controller.abort()
  }, [])
  const reference = useMemo(() => {
    try { return publicAvailability(prepareSeatReference(formValues, initialValues.travelDate ? initialValues : undefined), settings.validityHours) }
    catch { return null /* Invalid input is handled by the CMS fields. */ }
  }, [formValues.availableSeats, formValues.lastSeats, formValues.seatsConfirmed, formValues.seatsCheckedAt, formValues.travelDate, formValues.origin, formValues.programRef, initialValues.availableSeats, initialValues.lastSeats, initialValues.seatsCheckedAt, initialValues.travelDate, initialValues.origin, initialValues.programRef, settings.validityHours])
  const availability = useSeatAvailability(reference)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const promotionIDs = (Array.isArray(formValues.promotions) ? formValues.promotions : []).map(value => typeof value === 'object' && value ? value.id : value).filter(Boolean).map(String).join(',')
  useEffect(() => {
    setPromotions([])
    if (!promotionIDs) return
    const controller = new AbortController()
    const query = new URLSearchParams({ 'where[id][in]': promotionIDs, depth: '0', limit: String(promotionIDs.split(',').length) })
    fetch(`/api/campaigns?${query}`, { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => { if (data?.docs) setPromotions(data.docs.filter((p: Promotion) => isActivePeriod(p)).map((p: { id: string | number; name: string; label: string }) => ({ id: String(p.id), name: p.name, label: p.label }))) }).catch(() => {})
    return () => controller.abort()
  }, [promotionIDs])
  const [shared, setShared] = useState<Record<string, any> | null>(null)
  const ref = formValues.programRef as string | number | { id: string | number } | null
  const id = ref && typeof ref === 'object' ? ref.id : ref
  useEffect(() => {
    setShared(null)
    if (!id) return
    const controller = new AbortController()
    fetch(`/api/programs/${id}?depth=1`, { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(setShared).catch(() => {})
    return () => controller.abort()
  }, [id])
  const values = { ...formValues, ...(shared ? Object.fromEntries(['program', 'mtpe', 'days', 'nights', 'flyerSourceUrl'].map(key => [key, shared[key]])) : {}) }
  const [uploadedUrl, setUploadedUrl] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setUploadedUrl('')
    if (values.flyer) fetch(`/api/media/${values.flyer}`, { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(doc => { if (doc?.url) setUploadedUrl(doc.url) }).catch(() => {})
    return () => controller.abort()
  }, [values.flyer])
  let date = 'Fecha pendiente'
  try { retirementAt(String(values.travelDate), 0); date = formatDate(String(values.travelDate)) } catch {}
  const imageUrl = (shared ? shared.flyer?.url : uploadedUrl) || String(values.flyerSourceUrl || '') || DEFAULT_FLYER
  return <section className="mt-card-preview" aria-label="Vista previa de la tarjeta"><h3>Vista previa antes de publicar</h3><p>La referencia de cupos refleja cómo quedará al guardar. La revisión se renueva al cambiar los cupos o confirmar su vigencia.</p><div className="mt-preview-card">
    <img src={imageUrl} alt={`Flyer de ${values.program || 'programa'}`} width="600" height="600" onError={e => { if (e.currentTarget.getAttribute('src') !== DEFAULT_FLYER) e.currentTarget.src = DEFAULT_FLYER }}/>
    {availability?.lastSeats && <LastSeatsBadge seats={availability.seats}/>}
    <div><small>MTPE {String(values.mtpe || '')}</small><PromotionLabels promotions={promotions}/><h4>{titleCase(String(values.program || 'Nombre del programa'))}</h4><p>{date} · {Number(values.days || 0)} días</p><SeatAvailability availability={availability} bookingUrl="" contactUrl={settings.contactUrl} preview showQuantity={!availability?.lastSeats}/><strong>{formatMoney(Number(values.price || 0), String(values.currency || 'USD'))}</strong><p>{String(values.priceCondition || '')}</p><span className="mt-fake-button">Reservar en Meganet ↗</span></div>
  </div></section>
}
