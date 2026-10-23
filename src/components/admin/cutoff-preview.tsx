'use client'
import { useFormFields } from '@payloadcms/ui'
import { retirementAt } from '@/lib/lifecycle'
export function CutoffPreview() {
  const date = useFormFields(([fields]) => fields.travelDate?.value) as string
  const days = useFormFields(([fields]) => fields.advanceDays?.value) as number
  let label = 'Indica la fecha de salida para calcular el retiro.'
  try { label = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' }).format(new Date(retirementAt(date, Number(days ?? 30)))) + ' a las 00:00 (Lima)' } catch {}
  return <div className="mt-cutoff"><strong>Retiro previsto</strong><span>{label}</span></div>
}
