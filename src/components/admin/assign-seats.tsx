"use client";
import { useDocumentInfo, useListQuery, useSelection } from '@payloadcms/ui';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Preview = { token: string; preparedAt: number; rows: { id: string | number; date: string; origin: string; before: number | null; after: number | null; lastSeatsBefore: boolean; lastSeatsAfter: boolean }[] };
function SeatAssignment({ programId, ids, onApplied }: { programId?: string | number; ids?: (string | number)[]; onApplied?: () => void }) {
  const [quantity, setQuantity] = useState(''), [changeQuantity, setChangeQuantity] = useState(true);
  const [flag, setFlag] = useState('keep'), [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [result, setResult] = useState('');
  const router = useRouter();
  const signature = JSON.stringify([programId, ids, changeQuantity, quantity, flag]);
  const [preparedSignature, setPreparedSignature] = useState('');
  async function run(action: 'preview' | 'apply') {
    setBusy(true); setError(''); setResult('');
    try {
      const response = await fetch('/api/admin-tools/assign-seats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, programId, ids, ...(changeQuantity ? { availableSeats: quantity === '' ? null : Number(quantity) } : {}), ...(flag !== 'keep' ? { lastSeats: flag === 'yes' } : {}), confirmation: preview && { token: preview.token, preparedAt: preview.preparedAt } }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'No se pudieron asignar los cupos.');
      if (action === 'preview') { setPreview(body); setPreparedSignature(signature); }
      else { setPreview(null); setResult(`Disponibilidad actualizada en ${body.updated} ${body.updated === 1 ? "salida" : "salidas"}.`); router.refresh(); onApplied?.(); window.dispatchEvent(new Event('mt-departures-changed')); }
    } catch (e) { setError((e as Error).message); setPreview(null); }
    finally { setBusy(false); }
  }
  return <details className="mt-seat-assignment"><summary>Asignar cupos {programId ? 'a las salidas del programa' : `a la selección (${ids?.length || 0})`}</summary>
    <p>Fija la disponibilidad actual, con las ventas anteriores ya consideradas. Las reservas conocidas se conservan.</p>
    <fieldset disabled={busy}>
      <label className="mt-check"><input type="checkbox" checked={changeQuantity} onChange={e => setChangeQuantity(e.target.checked)} />Aplicar cantidad</label>
      {changeQuantity && <label>Cupos disponibles<input type="number" min="0" step="1" value={quantity} onChange={e => setQuantity(e.target.value)} /><small>Vacío: sin informar. Cero: sin cupos.</small></label>}
      <label>Etiqueta «Últimos cupos»<select value={flag} onChange={e => setFlag(e.target.value)}><option value="keep">Conservar por salida</option><option value="yes">Activar</option><option value="no">Desactivar</option></select></label>
      <button type="button" className="mt-tool-button secondary" disabled={(!programId && !ids?.length) || (!changeQuantity && flag === 'keep')} onClick={() => void run('preview')}>Vista previa de cupos</button>
      {preview && preparedSignature === signature && <div>
        <table><thead><tr><th>Fecha</th><th>Origen</th><th>Saldo anterior</th><th>Nuevo saldo</th><th>Últimos cupos</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.id}><td>{row.date}</td><td>{row.origin}</td><td>{row.before ?? 'Sin informar'}</td><td>{row.after ?? 'Sin informar'}</td><td>{row.lastSeatsBefore ? 'Sí' : 'No'} → {row.lastSeatsAfter ? 'Sí' : 'No'}</td></tr>)}</tbody></table>
        <button type="button" className="mt-tool-button" onClick={() => void run('apply')}>Confirmar disponibilidad actual</button>
      </div>}
    </fieldset>
    {error && <p role="alert">{error}</p>}{result && <p role="status">{result}</p>}
  </details>;
}
export function BulkSeatAssignment() {
  const { selectedIDs, selectAll } = useSelection();
  const { refineListData, query } = useListQuery();
  return <SeatAssignment ids={selectAll === 'allAvailable' ? [] : selectedIDs} onApplied={() => void refineListData(query)} />;
}
export function ProgramSeatAssignment() {
  const { id } = useDocumentInfo();
  return id ? <SeatAssignment programId={id} /> : null;
}
