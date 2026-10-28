'use client'
import { useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'
import { DEFAULT_FLYER } from '@/lib/flyer'

export function ProgramSummary() {
  const ref = useFormFields(([fields]) => fields.programRef?.value) as string | number | { id: string | number } | null
  const id = ref && typeof ref === 'object' ? ref.id : ref
  const [program, setProgram] = useState<{ program: string; mtpe: string; days: number; flyer?: { url?: string }; flyerSourceUrl?: string } | null>(null)
  useEffect(() => {
    setProgram(null)
    if (!id) return
    const controller = new AbortController()
    fetch(`/api/programs/${id}?depth=1`, { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(setProgram).catch(() => {})
    return () => controller.abort()
  }, [id])
  if (!program) return null
  return <div className="mt-program-summary"><img src={program.flyer?.url || program.flyerSourceUrl || DEFAULT_FLYER} width="90" height="90" alt={`Flyer de ${program.program}`} onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_FLYER }}/><div><strong>{program.program}</strong><p>MTPE {program.mtpe} · {program.days} días</p><a href={`/admin/collections/programs/${id}`}>Editar programa, flyer y enlaces compartidos →</a></div></div>
}
