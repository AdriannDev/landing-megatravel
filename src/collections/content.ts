import path from 'node:path'
import type { CollectionConfig, Field, GlobalConfig } from 'payload'
import { contentAccess, isAdmin, isEditor, never } from '../server/access'
import { isDateOnly, safeExternalUrl } from '../lib/lifecycle'
import { prepareDeparture, recordDepartureAudit } from '../server/hooks'
import { DEFAULT_CONTACT_URL, DEFAULT_CONTACT_LABEL } from '../lib/brand-config'

const urlValidation = (value: unknown) => !value || safeExternalUrl(value) || 'Usa un enlace HTTPS completo, sin usuario ni contraseña.'
const period: Field[] = [
  { name: 'startsAt', label: 'Visible desde', type: 'date', admin: { description: 'Instante de inicio. El panel utiliza America/Lima.' } },
  { name: 'endsAt', label: 'Visible hasta (exclusivo)', type: 'date', validate: (value, { siblingData }) => {
    const start = siblingData && 'startsAt' in siblingData ? siblingData.startsAt : undefined
    return !value || !start || Date.parse(String(value)) > Date.parse(String(start)) || 'El fin debe ser posterior al inicio.'
  } },
]
export const Media: CollectionConfig = {
  slug: 'media', labels: { singular: 'Imagen', plural: 'Imágenes' },
  access: { ...contentAccess, read: () => true }, admin: { group: 'Contenido', useAsTitle: 'alt' },
  upload: { staticDir: path.resolve(process.env.MEDIA_DIR || 'media'), mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], crop: false, focalPoint: false },
  fields: [
    { name: 'alt', label: 'Texto alternativo', type: 'text', required: true },
    { name: 'sourceUrl', label: 'Enlace original', type: 'text', unique: true, index: true, access: { read: ({ req }) => !!req.user }, admin: { readOnly: true } },
  ],
}

function reference(slug: string, singular: string, plural: string): CollectionConfig {
  return { slug, labels: { singular, plural }, access: contentAccess, admin: { group: 'Catálogos', useAsTitle: 'name' }, fields: [{ name: 'name', label: 'Nombre', type: 'text', required: true, unique: true }] }
}
export const Destinations = reference('destinations', 'Destino', 'Destinos')
export const Origins = reference('origins', 'Origen', 'Orígenes')
export const CruiseLines = reference('cruise-lines', 'Naviera', 'Navieras')
export const Campaigns: CollectionConfig = {
  slug: 'campaigns', labels: { singular: 'Promoción', plural: 'Promociones' }, access: contentAccess,
  admin: { group: 'Contenido', useAsTitle: 'name', defaultColumns: ['name', 'label', 'startsAt', 'endsAt'] },
  fields: [
    { name: 'name', label: 'Nombre', type: 'text', required: true },
    { name: 'slug', label: 'Identificador', type: 'text', required: true, unique: true, validate: (value: unknown) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value)) || 'Usa minúsculas, números y guiones.' },
    { name: 'label', label: 'Etiqueta pública', type: 'text', required: true }, ...period,
  ],
}
export const Banners: CollectionConfig = {
  slug: 'banners', labels: { singular: 'Banner', plural: 'Banners' }, access: contentAccess,
  admin: { group: 'Contenido', useAsTitle: 'alt', defaultColumns: ['alt', 'enabled', 'order', 'startsAt', 'endsAt'] },
  fields: [
    { name: 'image', label: 'Imagen o GIF de escritorio', type: 'upload', relationTo: 'media', required: true },
    { name: 'staticImage', label: 'Alternativa estática', type: 'upload', relationTo: 'media', required: true, admin: { description: 'Obligatoria para respetar las preferencias de movimiento reducido.' } },
    { name: 'mobileImage', label: 'Versión móvil', type: 'upload', relationTo: 'media' },
    { name: 'alt', label: 'Texto alternativo', type: 'text', required: true },
    { name: 'href', label: 'Enlace opcional', type: 'text', validate: urlValidation },
    { name: 'order', label: 'Orden', type: 'number', defaultValue: 0 },
    { name: 'enabled', label: 'Publicado', type: 'checkbox', defaultValue: false }, ...period,
  ],
}

export const Departures: CollectionConfig = {
  slug: 'departures', labels: { singular: 'Salida', plural: 'Salidas' },
  access: { create: isEditor, read: isEditor, update: isEditor, delete: never, readVersions: isEditor },
  admin: {
    group: 'Contenido', useAsTitle: 'program', defaultColumns: ['program', 'mtpe', 'travelDate', 'price', 'origin', 'status', 'withdrawalAt'],
    listSearchableFields: ['program', 'mtpe'],
    preview: data => `/preview/${data.id}`,
    components: { beforeListTable: ['/components/admin/workspace-tools#WorkspaceTools'] },
    description: 'Una tarjeta por salida. Usa las herramientas para duplicar programas o crear varias fechas.',
  },
  disableDuplicate: true,
  versions: { maxPerDoc: 50 },
  hooks: { beforeChange: [prepareDeparture], afterChange: [recordDepartureAudit] },
  fields: [
    { name: 'stableId', label: 'Identificador estable', type: 'text', unique: true, index: true, admin: { hidden: true, readOnly: true }, access: { create: () => false, update: () => false } },
    { type: 'tabs', tabs: [
      { label: 'Información comercial', fields: [
        { name: 'program', label: 'Programa', type: 'text', required: true, index: true },
        { name: 'mtpe', label: 'Código MTPE', type: 'text', required: true, index: true },
        { type: 'row', fields: [
          { name: 'destination', label: 'Destino', type: 'relationship', relationTo: 'destinations', required: true },
          { name: 'zone', label: 'Zona', type: 'text', required: true, index: true },
          { name: 'origin', label: 'Origen', type: 'relationship', relationTo: 'origins', required: true },
        ] },
        { name: 'cruiseLine', label: 'Naviera (solo cruceros)', type: 'relationship', relationTo: 'cruise-lines' },
        { type: 'row', fields: [
          { name: 'price', label: 'Precio desde', type: 'number', min: 0, required: true },
          { name: 'currency', label: 'Moneda', type: 'select', required: true, defaultValue: 'USD', options: [{ label: 'Dólares (USD)', value: 'USD' }, { label: 'Soles (PEN)', value: 'PEN' }] },
        ] },
        { name: 'priceCondition', label: 'Condición del precio', type: 'text', required: true, defaultValue: 'Por persona en habitación doble' },
        { name: 'promotions', label: 'Promociones', type: 'relationship', relationTo: 'campaigns', hasMany: true },
        { name: 'priority', label: 'Prioridad en destacados', type: 'number', defaultValue: 0, admin: { description: 'Un valor mayor aparece primero.' } },
      ] },
      { label: 'Salida y retiro', fields: [
        { name: 'travelDate', label: 'Fecha de salida (AAAA-MM-DD)', type: 'text', required: true, index: true, validate: (value: unknown) => isDateOnly(value) || 'Indica una fecha válida con formato AAAA-MM-DD.' },
        { type: 'row', fields: [
          { name: 'days', label: 'Días', type: 'number', min: 1, required: true, validate: (value: unknown) => Number.isInteger(value) && Number(value) > 0 || 'Indica días enteros.' },
          { name: 'nights', label: 'Noches', type: 'number', min: 0 },
          { name: 'advanceDays', label: 'Retirar con anticipación (días)', type: 'number', required: true, defaultValue: 30, min: 0, max: 3650, validate: (value: unknown) => Number.isInteger(value) || 'Indica un número entero.' },
        ] },
        { name: 'withdrawalAt', label: 'Fecha de retiro calculada', type: 'date', index: true, admin: { readOnly: true, description: 'Se retira a las 00:00 de Lima. Guarda el borrador para actualizar este valor.' }, access: { create: () => false, update: () => false } },
        { name: 'cutoffPreview', type: 'ui', admin: { components: { Field: '/components/admin/cutoff-preview#CutoffPreview' } } },
      ] },
      { label: 'Flyer y enlaces', fields: [
        { name: 'flyer', label: 'Flyer cuadrado', type: 'upload', relationTo: 'media' },
        { name: 'flyerSourceUrl', label: 'O pegar enlace de imagen (HTTPS)', type: 'text', validate: urlValidation, admin: { description: 'Al guardar se intenta descargar automáticamente. Si falla, se conserva el enlace para mostrar la imagen.' } },
        { name: 'flyerDownloadWarning', label: 'Resultado de copia del flyer', type: 'text', admin: { readOnly: true }, access: { create: () => false, update: () => false } },
        { name: 'bookingUrl', label: 'Reservar en Meganet', type: 'text', validate: urlValidation },
        { name: 'descriptionUrl', label: 'Ver descriptivo', type: 'text', validate: urlValidation },
        { name: 'cardPreview', type: 'ui', admin: { components: { Field: '/components/admin/card-preview#CardPreview' } } },
      ] },
      { label: 'Publicación', fields: [
        { name: 'status', label: 'Estado', type: 'select', required: true, defaultValue: 'draft', index: true, options: [{ label: 'Borrador', value: 'draft' }, { label: 'Publicado', value: 'published' }, { label: 'Retirado', value: 'withdrawn' }] },
        { name: 'reviewConfirmed', label: 'Revisé precio, enlaces y vigencia para reactivar esta salida', type: 'checkbox', defaultValue: false, admin: { description: 'Obligatorio al reactivar. La confirmación se registra y vuelve a desmarcarse al guardar.' } },
        { name: 'withdrawalReason', label: 'Motivo de retiro', type: 'select', options: [{ label: 'Solicitud del área', value: 'request' }, { label: 'Sin stock', value: 'sold-out' }, { label: 'Cambio de precio', value: 'price-change' }, { label: 'Otro', value: 'other' }, { label: 'Automático (sistema)', value: 'automatic' }], admin: { condition: data => data.status === 'withdrawn' } },
        { name: 'withdrawalNote', label: 'Observación del retiro', type: 'textarea', admin: { condition: data => data.status === 'withdrawn', description: 'Obligatoria si el motivo es «Otro».' } },
        { name: 'retiredAt', label: 'Retiro registrado el', type: 'date', access: { create: () => false, update: () => false }, admin: { readOnly: true } },
        { name: 'retiredBy', label: 'Responsable del retiro', type: 'relationship', relationTo: 'users', access: { create: () => false, update: () => false }, admin: { readOnly: true } },
      ] },
      { label: 'Procedencia', fields: [
        { name: 'sourceKey', label: 'Clave de importación', type: 'text', unique: true, index: true, admin: { readOnly: true }, access: { update: () => false } },
        { name: 'sourceSheet', label: 'Hoja original', type: 'text', admin: { readOnly: true } },
        { name: 'sourceRef', label: 'Fila / referencia original', type: 'text', admin: { readOnly: true } },
        { name: 'sourceRetirementDate', label: 'Fecha de retiro en la fuente histórica', type: 'text', admin: { readOnly: true, description: 'Se conserva la fecha disponible sin inventar una hora ni un responsable.' } },
        { name: 'sourceRetirementRaw', label: 'Valor original del retiro histórico', type: 'text', admin: { readOnly: true } },
      ] },
    ] },
  ],
}

export const AuditLog: CollectionConfig = {
  slug: 'audit-log', labels: { singular: 'Cambio', plural: 'Historial de cambios' },
  access: { read: isEditor, create: never, update: never, delete: never },
  admin: { group: 'Control', useAsTitle: 'program', defaultColumns: ['createdAt', 'program', 'event', 'actorLabel'], description: 'Registro de cambios comerciales, retiros y reactivaciones. Solo lectura.' },
  fields: [
    { name: 'departureId', label: 'Identificador de salida', type: 'text', required: true, index: true },
    { name: 'program', label: 'Programa', type: 'text', required: true },
    { name: 'event', label: 'Acción', type: 'select', required: true, options: [{ label: 'Creada', value: 'created' }, { label: 'Actualizada', value: 'updated' }, { label: 'Retirada', value: 'withdrawn' }, { label: 'Reactivada', value: 'reactivated' }] },
    { name: 'actor', label: 'Usuario', type: 'relationship', relationTo: 'users' },
    { name: 'actorLabel', label: 'Responsable', type: 'text', required: true },
    { name: 'changes', label: 'Valores anteriores y nuevos', type: 'json', required: true },
  ],
}
export const Settings: GlobalConfig = {
  slug: 'settings', label: 'Configuración del catálogo', access: { read: isAdmin, update: isAdmin },
  admin: { group: 'Configuración' },
  fields: [
    { name: 'contactUrl', label: 'Enlace de contacto comercial', type: 'text', required: true, defaultValue: DEFAULT_CONTACT_URL, validate: urlValidation },
    { name: 'contactLabel', label: 'Texto del botón de contacto', type: 'text', required: true, defaultValue: DEFAULT_CONTACT_LABEL },
  ],
}
