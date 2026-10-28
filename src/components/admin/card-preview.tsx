'use client'
import { useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import { retirementAt } from '@/lib/lifecycle'
import { formatDate, formatMoney, titleCase } from '@/lib/catalog'
import { DEFAULT_FLYER } from '@/lib/flyer'
export function CardPreview() {
  const formValues = useFormFields(([fields]) => Object.fromEntries(['programRef', 'program', 'mtpe', 'travelDate', 'days', 'nights', 'price', 'currency', 'priceCondition', 'flyerSourceUrl', 'flyer'].map(key => [key, fields[key]?.value])))
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
  return <section className="mt-card-preview" aria-label="Vista previa de la tarjeta"><h3>Vista previa antes de publicar</h3><div className="mt-preview-card"><img src={imageUrl} alt={`Flyer de ${values.program || 'programa'}`} width="600" height="600" onError={e => { if (e.currentTarget.getAttribute('src') !== DEFAULT_FLYER) e.currentTarget.src = DEFAULT_FLYER }}/><div><small>MTPE {String(values.mtpe || '')}</small><h4>{titleCase(String(values.program || 'Nombre del programa'))}</h4><p>{date} · {Number(values.days || 0)} días</p><strong>{formatMoney(Number(values.price || 0), String(values.currency || 'USD'))}</strong><p>{String(values.priceCondition || '')}</p><span className="mt-fake-button">Reservar en Meganet ↗</span></div></div></section>
}
