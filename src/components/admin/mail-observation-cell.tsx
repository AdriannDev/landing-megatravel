import type { DefaultCellComponentProps } from 'payload'

export function MailObservationCell({ cellData, rowData }: DefaultCellComponentProps) {
  const blocked = cellData !== 'warning' || rowData.outcome === 'review'
  return <strong style={{ color: blocked ? '#a12525' : '#805400' }}>{blocked ? 'Movimiento bloqueado' : 'Advertencia: movimiento aplicado'}</strong>
}
