'use client'
import { useEffect, useState } from 'react'
type Source = { id: string | number; program: string; mtpe: string; price: number; date: string; status: string; flyerUrl: string }
type Report = { error?: string; accepted?: number; errors?: number; dryRun?: boolean; results?: { row?: number; id?: string | number; status: string; message?: string }[]; created?: { id: string | number; date: string; href: string }[]; remaining?: number }
export function WorkspaceTools() {
  const [sources, setSources] = useState<Source[]>([]), [sourceId, setSourceId] = useState('')
  const [rows, setRows] = useState([{ date: '', price: '' }]), [busy, setBusy] = useState(false), [report, setReport] = useState<Report | null>(null)
  const [file, setFile] = useState<File | null>(null), [downloadImages, setDownloadImages] = useState(true), [validatedFile, setValidatedFile] = useState<File | null>(null)
  const [viewNow, setViewNow] = useState('')
  useEffect(() => {
    setViewNow(new Date().toISOString())
    const controller = new AbortController()
    fetch('/api/admin-tools/options', { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(data => { if (data?.departures) setSources(data.departures) }).catch(() => {})
    return () => controller.abort()
  }, [])
  const source = sources.find(s => String(s.id) === sourceId)
  const call = async (action: string, body: BodyInit, multipart = false) => {
    setBusy(true); setReport(null)
    try { const response = await fetch('/api/admin-tools/' + action, { method: 'POST', headers: multipart ? undefined : { 'Content-Type': 'application/json' }, body }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.'); setReport(data); return data }
    catch (error) { setReport({ error: (error as Error).message }); return null }
    finally { setBusy(false) }
  }
  const csv = async (dryRun: boolean) => {
    if (!file || (!dryRun && validatedFile !== file)) return
    const body = new FormData(); body.set('file', file); body.set('dryRun', String(dryRun)); body.set('downloadImages', String(downloadImages))
    const response = await call('import', body, true)
    if (dryRun && response?.accepted > 0) setValidatedFile(file)
    if (!dryRun) setValidatedFile(null)
  }
  const view = (name: string, params: Record<string, string>) => { const query = new URLSearchParams(params); return <a href={'/admin/collections/departures?' + query.toString()}>{name}</a> }
  return <section className="mt-workspace"><div className="mt-workspace-title"><div><small>MEGATRAVEL · EQUIPO COMERCIAL</small><h2>Gestiona tus próximas salidas</h2><p>Publica, duplica y mantén tus paquetes al día.</p></div><a className="mt-tool-button secondary" href="/" target="_blank" rel="noopener noreferrer">Ver catálogo ↗</a></div>
    <nav className="mt-saved-views" aria-label="Vistas de salidas">
      {view('Publicados', { 'where[status][equals]': 'published' })}
      {view('Próximos a retirarse', { 'where[and][0][status][equals]': 'published', 'where[and][1][withdrawalAt][greater_than]': viewNow, 'where[and][2][withdrawalAt][less_than_equal]': viewNow ? new Date(Date.parse(viewNow) + 7 * 86400000).toISOString() : '', sort: 'withdrawalAt' })}
      {view('Retirados', { 'where[status][equals]': 'withdrawn' })}{view('Borradores', { 'where[status][equals]': 'draft' })}
    </nav>
    <div className="mt-tool-grid"><details><summary>Duplicar un programa y crear salidas</summary><form onSubmit={async event => { event.preventDefault(); await call('duplicate', JSON.stringify({ sourceId, departures: rows.map(r => ({ date: r.date, price: Number(r.price) })) })) }}><label>Programa existente<select required value={sourceId} onChange={event => { setSourceId(event.target.value); const selected = sources.find(s => String(s.id) === event.target.value); setRows([{ date: '', price: String(selected?.price || '') }]) }}><option value="">Selecciona una salida como plantilla</option>{sources.map(s => <option key={s.id} value={s.id}>{s.program} · MTPE {s.mtpe} · {s.date}</option>)}</select></label>
      {rows.map((row, index) => <div className="mt-new-departure" key={index}><label>Fecha de salida<input aria-label={`Fecha de salida ${index + 1}`} type="date" required value={row.date} onChange={e => setRows(values => values.map((r, i) => i === index ? { ...r, date: e.target.value } : r))}/></label><label>Precio<input aria-label={`Precio de salida ${index + 1}`} type="number" step="0.01" min="0.01" required value={row.price} onChange={e => setRows(values => values.map((r, i) => i === index ? { ...r, price: e.target.value } : r))}/></label>{rows.length > 1 && <button type="button" aria-label={`Quitar salida ${index + 1}`} onClick={() => setRows(values => values.filter((_, i) => i !== index))}>×</button>}</div>)}
      <button className="mt-inline-button" type="button" disabled={rows.length >= 30} onClick={() => setRows(values => [...values, { date: '', price: String(source?.price || '') }])}>+ Añadir otra fecha</button>
      {source && <p className="mt-tool-note">Se copiarán flyer, programa y enlaces. Las {rows.length} salidas se crearán como borradores para previsualizarlas antes de publicar.</p>}
      <button className="mt-tool-button" disabled={busy || !sourceId} type="submit">Crear {rows.length === 1 ? 'borrador' : `${rows.length} borradores`}</button></form></details>
    <details><summary>Importar o exportar CSV</summary><div className="mt-import-form"><p>Primero valida el archivo. Las claves de importación permiten actualizar sin duplicar salidas.</p><input type="file" accept=".csv,text/csv" aria-label="Archivo CSV de salidas" onChange={e => { setFile(e.target.files?.[0] || null); setValidatedFile(null) }}/><label className="mt-check"><input type="checkbox" checked={downloadImages} onChange={e => setDownloadImages(e.target.checked)}/>Descargar flyers al almacenamiento</label><div className="mt-action-row"><button className="mt-tool-button secondary" disabled={!file || busy} onClick={() => csv(true)}>Validar sin importar</button><button className="mt-tool-button" disabled={!file || validatedFile !== file || busy} onClick={() => csv(false)}>Importar filas válidas</button></div><a href="/api/admin-tools/export" className="mt-export-link">Exportar catálogo completo en CSV</a></div></details>
    <details><summary>Copiar imágenes desde sus enlaces</summary><div className="mt-import-form"><p>Copia hasta 50 flyers pendientes por operación. Conserva los enlaces originales y reutiliza imágenes ya descargadas.</p><button className="mt-tool-button secondary" disabled={busy} onClick={() => call('images', '{}')}>Descargar imágenes pendientes</button></div></details></div>
    {busy && <p role="status">Procesando… Mantén esta página abierta.</p>}
    {report && <div className="mt-report" role="status">{report.error ? <p className="mt-report-error">{report.error}</p> : <>{report.accepted !== undefined && <p><strong>{report.dryRun ? 'Validación' : 'Importación'}:</strong> {report.accepted} filas válidas, {report.errors || 0} con errores.</p>}{report.created?.map(item => <p key={item.id}><a href={item.href}>Abrir borrador del {item.date} → previsualizar y publicar</a></p>)}{report.remaining !== undefined && <p>Quedan {report.remaining} imágenes para la siguiente operación.</p>}{report.results && <details><summary>Ver reporte por fila</summary><div className="mt-report-rows">{report.results.map((result, i) => <p key={i}>Fila {result.row ?? result.id}: {result.status}{result.message ? ' — ' + result.message : ''}</p>)}</div></details>}</>}</div>}
  </section>
}
