import type { CollectionConfig, Field } from 'payload'
import { isAdmin, never } from '../server/access'

function readonly(slug: string, singular: string, plural: string, fields: Field[], columns: string[]): CollectionConfig {
  return { slug, labels: { singular, plural }, access: { read: isAdmin, create: never, update: never, delete: never },
    admin: { group: 'Piloto de correo', useAsTitle: columns[0], defaultColumns: columns, description: 'Simulación privada. Estos registros nunca modifican los cupos del catálogo.' }, fields }
}
export const SeatPilotPools = readonly('seat-pilot-pools', 'Saldo simulado', 'Saldos simulados', [
  { name: 'mtpe', type: 'text', required: true, unique: true, index: true },
  { name: 'programId', label: 'ID de programa original', type: 'text', required: true },
  { name: 'programCreatedAt', label: 'Creación del programa original', type: 'date', required: true },
  { name: 'programName', label: 'Programa', type: 'text', required: true },
  { name: 'initialSeats', label: 'Saldo inicial conciliado', type: 'number', required: true, min: 0 },
  { name: 'remainingSeats', label: 'Saldo simulado', type: 'number', required: true, min: 0 },
  { name: 'cutoffAt', label: 'Fecha de corte', type: 'date', required: true },
  { name: 'actorLabel', label: 'Responsable del saldo inicial', type: 'text', required: true },
], ['mtpe', 'programName', 'initialSeats', 'remainingSeats', 'cutoffAt'])
export const SeatPilotReservations = readonly('seat-pilot-reservations', 'Reserva simulada', 'Reservas simuladas', [
  { name: 'key', type: 'text', required: true, unique: true },
  { name: 'mtpe', type: 'text', required: true, index: true },
  { name: 'reservation', label: 'Referencia de reserva', type: 'text', required: true },
  { name: 'state', label: 'Estado normalizado (sin pasajeros)', type: 'json', required: true },
], ['reservation', 'mtpe', 'updatedAt'])
export const SeatMailEvents = readonly('seat-mail-events', 'Aviso de correo', 'Revisión de correo', [
  { name: 'messageKey', label: 'Huella del mensaje', type: 'text', required: true, unique: true },
  { name: 'eventKey', label: 'Huella del evento', type: 'text', unique: true },
  { name: 'duplicateOf', label: 'Evento repetido', type: 'text' },
  { name: 'mtpe', type: 'text', index: true },
  { name: 'reservation', label: 'Referencia de reserva', type: 'text' },
  { name: 'outcome', label: 'Resultado', type: 'select', required: true, index: true, options: [{ label: 'Movimiento simulado', value: 'proposed' }, { label: 'Requiere revisión', value: 'review' }, { label: 'Duplicado', value: 'duplicate' }] },
  { name: 'reason', label: 'Detalle', type: 'textarea', required: true },
  { name: 'event', label: 'Evento comercial (sin pasajeros)', type: 'json' },
  { name: 'delta', label: 'Variación simulada', type: 'number' },
  { name: 'balanceBefore', label: 'Saldo simulado anterior', type: 'number' },
  { name: 'balanceAfter', label: 'Saldo simulado posterior', type: 'number' },
], ['createdAt', 'mtpe', 'reservation', 'outcome', 'delta', 'reason'])
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
