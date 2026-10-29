import type { DefaultServerCellComponentProps } from 'payload'
import { seatReviewState } from '@/lib/availability'
import { getSeatSettings } from '@/server/availability-settings'

export async function AvailabilityCell({ rowData, payload }: DefaultServerCellComponentProps) {
  const doc = 'availableSeats' in rowData && 'lastSeats' in rowData ? rowData : await payload.findByID({ collection: 'departures', id: rowData.id, overrideAccess: true, depth: 0 })
  const { validityHours } = await getSeatSettings(payload)
  const state = seatReviewState(doc, validityHours)
  const label = state === 'current' ? 'Vigente' : state === 'stale' ? 'Por revisar' : 'Sin informar'
  const date = doc.seatsCheckedAt ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(new Date(doc.seatsCheckedAt)) : ''
  return <span className={`mt-seat-state mt-seat-state-${state}`} title={date ? `Última revisión: ${date} (Lima)` : undefined}>{label}</span>
}
