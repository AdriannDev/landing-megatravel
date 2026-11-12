'use client'

import { useRef, useState } from 'react'
import { Button, useDocumentInfo, useForm, useFormModified, useFormProcessing } from '@payloadcms/ui'
import { RefreshCw } from 'lucide-react'

export function BlogRefresh() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  const running = useRef(false)
  const modified = useFormModified()
  const processing = useFormProcessing()
  const { reset, setProcessing } = useForm()
  const { setData } = useDocumentInfo()

  const refresh = async () => {
    if (running.current || modified || processing) return
    running.current = true
    setBusy(true)
    setProcessing(true)
    setFailed(false)
    setMessage('Buscando artículos y preparando sus imágenes…')
    try {
      const response = await fetch('/api/admin-tools/sync-blog', { method: 'POST' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo actualizar Mega Blog.')
      await reset(result.settings)
      setData(result.settings)
      setMessage(`Mega Blog actualizado: ${result.posts} artículos disponibles.`)
    } catch (error) {
      setFailed(true)
      setMessage(`${error instanceof Error ? error.message : 'No se pudo actualizar Mega Blog.'} Puedes volver a intentarlo.`)
    } finally {
      running.current = false
      setBusy(false)
      setProcessing(false)
    }
  }

  return (
    <div className="mt-blog-refresh" aria-busy={busy}>
      <div>
        <strong>Mega Blog</strong>
        <p>Se actualiza automáticamente cada cinco días. También puedes buscar nuevos artículos ahora.</p>
      </div>
      <Button type="button" buttonStyle="secondary" disabled={busy || modified || processing} onClick={refresh} icon={<RefreshCw size={16} aria-hidden="true" />}>
        {busy ? 'Actualizando…' : 'Actualizar ahora'}
      </Button>
      {modified && !busy && <p>Guarda los cambios del formulario para actualizar el blog.</p>}
      {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    </div>
  )
}
