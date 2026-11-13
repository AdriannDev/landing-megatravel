import type { CollectionConfig, Field, Where } from 'payload'
import { isAdmin, never } from '../server/access'

function readonly(slug: string, singular: string, plural: string, fields: Field[], columns: string[]): CollectionConfig {
  return { slug, labels: { singular, plural }, access: { read: isAdmin, create: never, update: never, delete: never },
    admin: { hidden: true, useAsTitle: columns[0], defaultColumns: columns }, fields }
}
export const SeatPilotPools = readonly('seat-pilot-pools', 'Saldo simulado', 'Saldos simulados', [
  { name: 'mtpe', type: 'text', required: true, index: true },
  { name: 'departureStableId', label: 'Salida original', type: 'text', unique: true, index: true },
  { name: 'travelDate', label: 'Fecha de viaje', type: 'text' },
  { name: 'origin', label: 'Origen', type: 'text' },
  { name: 'programId', label: 'ID de programa original', type: 'text', required: true },
  { name: 'programCreatedAt', label: 'Creación del programa original', type: 'date', required: true },
  { name: 'programName', label: 'Programa', type: 'text', required: true },
  { name: 'initialSeats', label: 'Saldo inicial conciliado', type: 'number', required: true, min: 0 },
  { name: 'remainingSeats', label: 'Saldo simulado', type: 'number', required: true, min: 0 },
  { name: 'cutoffAt', label: 'Fecha de corte', type: 'date', required: true },
  { name: 'actorLabel', label: 'Responsable del saldo inicial', type: 'text', required: true },
], ['mtpe', 'programName', 'initialSeats', 'remainingSeats', 'cutoffAt'])
export const SeatPilotReservations = readonly('seat-pilot-reservations', 'Reserva por correo', 'Reservas por correo', [
  { name: 'key', type: 'text', required: true, unique: true },
  { name: 'mtpe', type: 'text', required: true, index: true },
  { name: 'reservation', label: 'Referencia de reserva', type: 'text', required: true },
  { name: 'state', label: 'Estado normalizado (sin pasajeros)', type: 'json', required: true },
], ['reservation', 'mtpe', 'updatedAt'])
export const SeatMailEvents: CollectionConfig = { ...readonly('seat-mail-events', 'Correo observado', 'Correos observados', [
  { name: 'messageKey', label: 'Huella del mensaje', type: 'text', required: true, unique: true },
  { name: 'sourceKey', label: 'Huella del identificador original', type: 'text', unique: true, admin: { hidden: true } },
  { name: 'eventKey', label: 'Huella del evento', type: 'text', unique: true },
  { name: 'duplicateOf', label: 'Evento repetido', type: 'text' },
  { name: 'mtpe', label: 'MTPE', type: 'text', index: true },
  { name: 'origin', label: 'Origen', type: 'text' },
  { name: 'resolvedDeparture', label: 'Salida original resuelta', type: 'text' },
  { name: 'movements', label: 'Movimientos por salida', type: 'json' },
  { name: 'reservation', label: 'Reserva MTP', type: 'text' },
  { name: 'subject', label: 'Asunto', type: 'text' },
  { name: 'sender', label: 'Remitente', type: 'text' },
  { name: 'receivedAt', label: 'Fecha del mensaje', type: 'date' },
  { name: 'seats', label: 'Cantidad', type: 'number' },
  { name: 'status', label: 'Estado comercial', type: 'select', options: [{ label: 'A petición / Pendiente de confirmar', value: 'pending' }, { label: 'Reserva / Confirmada', value: 'confirmed' }, { label: 'Cancelado / Anulado', value: 'cancelled' }, { label: 'Vencido', value: 'expired' }] },
  { name: 'travelDate', label: 'Salida identificada', type: 'text' },
  { name: 'occurredAt', label: 'Fecha comercial', type: 'date' },
  { name: 'version', label: 'Versión comercial', type: 'number' },
  { name: 'observation', label: 'Observación', type: 'select', options: [{ label: 'Movimiento bloqueado', value: 'blocked' }, { label: 'Advertencia: movimiento aplicado', value: 'warning' }], admin: { components: { Cell: '/components/admin/mail-observation-cell#MailObservationCell' } } },
  { name: 'outcome', label: 'Resultado', type: 'select', required: true, index: true, options: [{ label: 'Movimiento procesado', value: 'proposed' }, { label: 'Requiere revisión', value: 'review' }, { label: 'Duplicado', value: 'duplicate' }] },
  { name: 'reason', label: 'Detalle', type: 'textarea', required: true },
  { name: 'event', label: 'Evento comercial (sin pasajeros)', type: 'json' },
  { name: 'delta', label: 'Variación de cupos', type: 'number' },
  { name: 'balanceBefore', label: 'Saldo anterior', type: 'number' },
  { name: 'balanceAfter', label: 'Saldo posterior', type: 'number' },
], []), admin: {
  group: 'Administración', useAsTitle: 'subject',
  description: 'Avisos que bloquearon un movimiento y advertencias de movimientos aplicados. Revisa el cuerpo completo en el buzón; no se guarda aquí.',
  defaultColumns: ['observation', 'subject', 'sender', 'receivedAt', 'mtpe', 'reservation', 'travelDate', 'origin', 'seats', 'status', 'reason'],
  baseFilter: (): Where => ({ or: [{ outcome: { equals: 'review' } }, { observation: { equals: 'warning' } }] }),
} }
export const MailSyncCursors = readonly('mail-sync-cursors', 'Lector de correo', 'Lectores de correo', [
  { name: 'key', type: 'text', required: true, unique: true },
  { name: 'provider', label: 'Proveedor', type: 'select', defaultValue: 'microsoft-graph', options: [{ label: 'Gmail (IMAP)', value: 'gmail-imap' }, { label: 'Microsoft Graph', value: 'microsoft-graph' }] },
  { name: 'uidValidity', label: 'UIDVALIDITY de carpeta', type: 'text' },
  { name: 'lastUid', label: 'Último UID procesado', type: 'number', min: 0 },
  { name: 'cursor', type: 'text', admin: { hidden: true } },
  { name: 'owner', type: 'text', admin: { hidden: true } },
  { name: 'leaseUntil', label: 'Ejecución reservada hasta', type: 'date' },
  { name: 'lastSuccessAt', label: 'Última lectura correcta', type: 'date' },
], ['provider', 'lastSuccessAt', 'leaseUntil'])
