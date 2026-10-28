import type { DefaultServerCellComponentProps } from 'payload'
import { isPublishable } from '@/lib/lifecycle'

export async function StatusCell({ cellData, rowData, payload }: DefaultServerCellComponentProps) {
  const doc = cellData === 'published' && (!rowData.travelDate || rowData.advanceDays == null) ? await payload.findByID({ collection: 'departures', id: rowData.id, overrideAccess: true, depth: 0 }) : rowData
  if (cellData === 'published' && !isPublishable(doc as any)) return <span title="El catálogo ya la oculta, aunque el retiro automático esté pendiente.">Vencida · pendiente de retiro</span>
  return <span>{cellData === 'published' ? 'Publicado' : cellData === 'withdrawn' ? 'Retirado' : 'Borrador'}</span>
}
