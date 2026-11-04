import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { CollectionConfig, Field, GlobalConfig } from 'payload'
import { contentAccess, isAdmin, isEditor, never } from '../server/access'
import { isDateOnly, safeExternalUrl } from '../lib/lifecycle'
import { prepareDeparture, recordDepartureAudit, recordDepartureDeletion } from '../server/hooks'
import { DEFAULT_CONTACT_URL, DEFAULT_CONTACT_LABEL } from '../lib/brand-config'
import { prepareProgram, resolveDepartureProgram, syncProgramSnapshots } from '../server/program-hooks'
import { departureViewWhere, parseDepartureView } from '../lib/admin-views'
import { sharedFields } from '../lib/programs'
import { DEFAULT_SEATS_VALIDITY_HOURS, MAX_SEATS_VALIDITY_HOURS, validSeatCount } from '../lib/availability'
import { getSeatSettings } from '../server/availability-settings'
import { optimizeMedia } from '../server/optimize-media'

const urlValidation = (value: unknown) => !value || safeExternalUrl(value) || 'Usa un enlace HTTPS completo, sin usuario ni contraseña.'
const period: Field[] = [
  { name: 'startsAt', label: 'Visible desde', type: 'date', admin: { description: 'Instante de inicio. El panel utiliza America/Lima.' } },
  { name: 'endsAt', label: 'Visible hasta (exclusivo)', type: 'date', validate: (value: unknown, { siblingData }: { siblingData?: Record<string, unknown> }) => {
    const start = siblingData && 'startsAt' in siblingData ? siblingData.startsAt : undefined
    return !value || !start || Date.parse(String(value)) > Date.parse(String(start)) || 'El fin debe ser posterior al inicio.'
  } },
]
export const Media: CollectionConfig = {
  slug: 'media', labels: { singular: 'Imagen', plural: 'Imágenes' },
  access: { ...contentAccess, read: () => true }, admin: { group: 'Contenido', useAsTitle: 'alt', description: 'Biblioteca de imágenes. Programas: ideal 800 × 800 px; banners: 1600 × 600 px; popup: 1200 × 900 px; versión móvil: 800 × 800 px. Se admiten otros tamaños y proporciones. Máximo 12 MB, JPEG, PNG, WebP o GIF.' },
  upload: { staticDir: path.resolve(process.env.MEDIA_DIR || 'media'), mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], crop: false, focalPoint: false },
  hooks: { beforeOperation: [optimizeMedia] },
  fields: [
    { name: 'alt', label: 'Texto alternativo', type: 'text', required: true },
    { name: 'sourceUrl', label: 'Enlace original', type: 'text', unique: true, index: true, access: { read: ({ req }) => !!req.user }, admin: { readOnly: true } },
    // Keep the schema stable with or without the S3 adapter enabled.
    { name: '_objectKey', type: 'text', admin: { hidden: true, readOnly: true } },
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
  hooks: { beforeValidate: [({ data, operation }) => operation === 'create' && data && !data.slug ? { ...data, slug: `promo-${randomUUID()}` } : data] },
  fields: [
    { type: 'row', fields: [
      { name: 'name', label: 'Nombre', type: 'text', required: true, admin: { width: '50%' } },
      { name: 'label', label: 'Etiqueta pública', type: 'text', required: true, admin: { width: '50%' } },
    ] },
    { name: 'slug', type: 'text', required: true, unique: true, admin: { hidden: true }, validate: (value: unknown) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value)) || 'Identificador inválido.' },
    { type: 'row', fields: period },
  ],
}
export const Banners: CollectionConfig = {
  slug: 'banners', labels: { singular: 'Banner', plural: 'Banners' }, access: contentAccess,
  admin: { group: 'Contenido', useAsTitle: 'alt', defaultColumns: ['alt', 'placement', 'enabled', 'order', 'startsAt', 'endsAt'] },
  fields: [
    { name: 'placement', label: 'Ubicación', type: 'select', required: true, defaultValue: 'hero', options: [{ label: 'Hero', value: 'hero' }, { label: 'Entre resultados', value: 'between-results' }, { label: 'Final del catálogo', value: 'catalog-end' }, { label: 'Popup (ventana emergente)', value: 'popup' }], admin: { description: 'Si hay varios popups vigentes, se muestra solo el de menor orden.' } },
    { name: 'popupFormat', label: 'Formato del popup', type: 'select', defaultValue: 'text', options: [{ label: 'Imagen con texto', value: 'text' }, { label: 'Solo imagen', value: 'image' }], admin: { condition: data => data.placement === 'popup' } },
    { name: 'popupLabel', label: 'Etiqueta superior', type: 'text', maxLength: 120, admin: { condition: data => data.placement === 'popup' && data.popupFormat !== 'image' } },
    { name: 'title', label: 'Título del popup', type: 'text', maxLength: 120, validate: (value: unknown, { siblingData }: { siblingData?: Record<string, unknown> }) => siblingData?.placement !== 'popup' || siblingData?.popupFormat === 'image' || !!String(value || '').trim() || 'Escribe un título para el popup.', admin: { condition: data => data.placement === 'popup' && data.popupFormat !== 'image' } },
    { name: 'message', label: 'Texto de la noticia o promoción', type: 'textarea', maxLength: 2000, admin: { condition: data => data.placement === 'popup' && data.popupFormat !== 'image', description: 'Puedes publicar una noticia solo con título y texto, sin imagen.' } },
    { name: 'popupKind', label: 'Tipo de anuncio', type: 'select', defaultValue: 'promotion', options: [{ label: 'Promoción', value: 'promotion' }, { label: 'Noticia', value: 'news' }], admin: { condition: data => data.placement === 'popup' } },
    { name: 'buttonLabel', label: 'Texto del botón del popup', type: 'text', maxLength: 60, defaultValue: 'Conocer más', admin: { condition: data => data.placement === 'popup' && data.popupFormat !== 'image', description: 'El botón aparece cuando completas el enlace opcional.' } },
    { name: 'popupSecondaryLabel', label: 'Texto de acción secundaria', type: 'text', maxLength: 60, admin: { condition: data => data.placement === 'popup' && data.popupFormat !== 'image', description: 'Si queda vacío se mostrará «Seguir explorando».' } },
    { name: 'popupFrequency', label: 'Frecuencia del popup', type: 'select', defaultValue: 'session', options: [{ label: 'Una vez por sesión', value: 'session' }, { label: 'Una vez cada 24 horas', value: 'daily' }, { label: 'Cada visita al catálogo', value: 'always' }], admin: { condition: data => data.placement === 'popup' } },
    { name: 'popupDelay', label: 'Espera antes de abrir (segundos)', type: 'number', defaultValue: 2, min: 0, max: 60, admin: { condition: data => data.placement === 'popup' } },
    { name: 'image', label: 'Imagen o GIF de escritorio', type: 'upload', relationTo: 'media', validate: (value: unknown, { siblingData }: { siblingData?: Record<string, unknown> }) => (siblingData?.placement === 'popup' && siblingData?.popupFormat !== 'image') || !!value || 'Selecciona una imagen.', admin: { description: 'Tamaño ideal para banners (Hero, entre resultados y final): 1600 × 600 px. Popup: 1200 × 900 px. Se adapta a otros tamaños y proporciones y muestra la imagen completa, sin recortarla. Máximo 12 MB.' } },
    { name: 'staticImage', label: 'Alternativa estática', type: 'upload', relationTo: 'media', admin: { hidden: true } },
    { name: 'mobileImage', label: 'Imagen para móvil (opcional)', type: 'upload', relationTo: 'media', admin: { description: 'Ideal: 800 × 800 px. Admite otras proporciones y muestra la imagen completa. Si no se agrega, se usa la imagen de escritorio. Máximo 12 MB.' } },
    { name: 'alt', label: 'Texto alternativo', type: 'text', required: true },
    { name: 'href', label: 'Enlace opcional', type: 'text', validate: urlValidation },
    { name: 'popupPreview', type: 'ui', admin: { condition: data => data.placement === 'popup', components: { Field: '/components/admin/popup-preview#PopupPreview' } } },
    { name: 'order', label: 'Orden', type: 'number', defaultValue: 0 },
    { name: 'enabled', label: 'Publicado', type: 'checkbox', defaultValue: false }, ...period,
  ],
}

// Layout-only rows preserve the existing field paths and stored documents.
function pairedFields(fields: Field[], pairs: string[][]): Field[] {
  const paired = new Set(pairs.flat())
  return fields.flatMap(field => {
    if (!('name' in field) || !paired.has(field.name)) return [field]
    const pair = pairs.find(names => names[0] === field.name)
    if (!pair) return []
    return [{ type: 'row', admin: { className: 'mt-two-column-row' }, fields: pair.map(name => fields.find(candidate => 'name' in candidate && candidate.name === name)!).filter(Boolean) } as Field]
  })
}
Banners.fields = pairedFields(Banners.fields, [['placement', 'popupFormat'], ['popupLabel', 'title'], ['buttonLabel', 'popupSecondaryLabel'], ['popupFrequency', 'popupDelay'], ['alt', 'href'], ['startsAt', 'endsAt']])

export const Departures: CollectionConfig = {
  slug: 'departures', labels: { singular: 'Salida', plural: 'Salidas' },
  access: { create: isEditor, read: isEditor, update: isEditor, delete: ({ req }) => req.user?.role === 'admin' ? { status: { equals: 'draft' } } : false, readVersions: isEditor },
  defaultSort: 'travelDate',
  admin: {
    group: 'Contenido', useAsTitle: 'program', defaultColumns: ['program', 'mtpe', 'travelDate', 'price', 'origin', 'status', 'seatsCheckedAt', 'withdrawalAt'],
    listSearchableFields: ['program', 'mtpe'],
    baseFilter: async ({ req }) => {
      const view = parseDepartureView(req.query?.mtView)
      const hours = view === 'seats-review' ? (await getSeatSettings(req.payload, req)).validityHours : DEFAULT_SEATS_VALIDITY_HOURS
      return departureViewWhere(view, new Date(), hours)
    },
    preview: data => `/preview/${data.id}`,
    components: { beforeListTable: ['/components/admin/workspace-tools#WorkspaceTools'] },
    description: 'Una tarjeta por fecha. El contenido compartido se edita en Programas.',
  },
  disableDuplicate: true,
  versions: { maxPerDoc: 50 },
  hooks: { beforeChange: [prepareDeparture], afterChange: [recordDepartureAudit], beforeDelete: [recordDepartureDeletion], afterRead: [resolveDepartureProgram] },
  fields: [
    { name: 'programRef', label: 'Programa compartido (MTPE)', type: 'relationship', relationTo: 'programs', admin: { description: 'Selecciona el programa. El nombre, la imagen, los enlaces y el saldo de cupos se comparten entre todas sus fechas.' } },
    { name: 'programSummary', type: 'ui', admin: { components: { Field: '/components/admin/program-summary#ProgramSummary' } } },
    { name: 'departureKey', type: 'text', unique: true, index: true, admin: { hidden: true }, access: { create: () => false, update: () => false } },
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
        { type: 'collapsible', label: 'Cupos referenciales', fields: [
          { name: 'availableSeats', label: 'Cupos compartidos del programa', type: 'number', min: 0, access: { create: () => false, update: () => false }, admin: { readOnly: true, description: 'Se edita en Programas y se aplica a todas sus fechas. Vacío significa sin cantidad informada.' } },
          { name: 'programLastSeats', label: '«Últimos cupos» del programa', type: 'checkbox', defaultValue: false, access: { create: () => false, update: () => false }, admin: { readOnly: true, description: 'Cuando está activo en el programa, se aplica a todas sus fechas.' } },
          { name: 'lastSeats', label: 'Destacar «Últimos cupos» solo en esta fecha', type: 'checkbox', defaultValue: false, admin: { description: 'Opcional. Se suma a la opción del programa; desmarcar esta fecha no anula la opción grupal. No cambia la cantidad de cupos.' } },
          { name: 'seatsCheckedAt', label: 'Última revisión de cupos del programa', type: 'date', index: true, access: { create: () => false, update: () => false }, admin: { readOnly: true, description: 'La vigencia del saldo se confirma en Programas (72 horas por defecto).', components: { Cell: '/components/admin/availability-cell#AvailabilityCell' } } },
          { name: 'lastSeatsCheckedAt', label: 'Última revisión de la etiqueta individual', type: 'date', access: { create: () => false, update: () => false }, admin: { readOnly: true } },
          { name: 'seatsConfirmed', label: 'Confirmo que «Últimos cupos» sigue vigente para esta fecha', type: 'checkbox', defaultValue: false, admin: { description: 'Renueva solo la etiqueta individual, sin modificar la revisión del saldo del programa.' } },
        ] },
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
      { label: 'Imagen y enlaces', fields: [
        { name: 'flyer', label: 'Imagen del programa', type: 'upload', relationTo: 'media' },
        { name: 'flyerSourceUrl', label: 'O pegar enlace de imagen (HTTPS)', type: 'text', validate: urlValidation, admin: { description: 'Al guardar se intenta descargar automáticamente. Si falla, se conserva el enlace para mostrar la imagen.' } },
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

// Keep the old columns and version payloads. New writes derive these fields from Programas.
function readonlyShared(fields: Field[]) {
  for (const field of fields) {
    if ('name' in field && sharedFields.includes(field.name as typeof sharedFields[number])) {
      Object.assign(field, { required: false, validate: undefined, admin: { ...field.admin, readOnly: true, description: field.name === 'flyer' ? 'Imagen compartida; se edita en Programas. Ideal: 800 × 800 px. Admite otros tamaños y proporciones, sin recortar. Máximo 12 MB.' : 'Contenido compartido. Edita este dato en Programas.' } })
    }
    if ('fields' in field) readonlyShared(field.fields)
    if (field.type === 'tabs') for (const tab of field.tabs) readonlyShared(tab.fields)
  }
}
readonlyShared(Departures.fields)
function tableCells(fields: Field[]) {
  for (const field of fields) {
    if (field.type === 'relationship' && !field.hasMany) field.admin = { ...field.admin, components: { ...field.admin?.components, Cell: '/components/admin/reference-cell#ReferenceCell' } }
    if (field.type === 'select' && field.name === 'status') field.admin = { ...field.admin, components: { ...field.admin?.components, Cell: '/components/admin/status-cell#StatusCell' } }
    if ('fields' in field) tableCells(field.fields)
    if (field.type === 'tabs') for (const tab of field.tabs) tableCells(tab.fields)
  }
}
tableCells(Departures.fields)

export const Programs: CollectionConfig = {
  slug: 'programs', labels: { singular: 'Programa', plural: 'Programas' },
  access: { ...contentAccess, delete: never, readVersions: isEditor },
  admin: { group: 'Contenido', useAsTitle: 'program', defaultColumns: ['program', 'mtpe', 'destination', 'availableSeats', 'lastSeats', 'flyer'], listSearchableFields: ['program', 'mtpe'], description: 'Un programa por MTPE. El saldo de cupos, la imagen y la información compartida se aplican a todas sus fechas.' },
  versions: { maxPerDoc: 50 },
  hooks: { beforeChange: [prepareProgram], afterChange: [syncProgramSnapshots] },
  fields: [
    { type: 'row', fields: [
      { name: 'program', label: 'Nombre del programa', type: 'text', required: true, index: true, admin: { width: '50%' } },
      { name: 'mtpe', label: 'Código MTPE', type: 'text', required: true, unique: true, index: true, admin: { width: '50%' } },
    ] },
    { type: 'row', fields: [
      { name: 'destination', label: 'Destino', type: 'relationship', relationTo: 'destinations', required: true, admin: { width: '50%' } },
      { name: 'zone', label: 'Zona', type: 'text', required: true, admin: { width: '50%' } },
    ] },
    { type: 'row', fields: [
      { name: 'days', label: 'Días', type: 'number', required: true, min: 1, admin: { width: '50%' }, validate: (value: unknown) => Number.isInteger(value) && Number(value) > 0 || 'Indica días enteros.' },
      { name: 'nights', label: 'Noches', type: 'number', min: 0, admin: { width: '50%' }, validate: (value: unknown) => value == null || Number.isInteger(value) && Number(value) >= 0 || 'Indica noches enteras.' },
    ] },
    { name: 'cruiseLine', label: 'Naviera (solo cruceros)', type: 'relationship', relationTo: 'cruise-lines' },
    { type: 'collapsible', label: 'Cupos compartidos del programa', admin: { initCollapsed: false }, fields: [
      { name: 'availableSeats', label: 'Cupos disponibles del programa (opcional)', type: 'number', min: 0, validate: (value: unknown) => validSeatCount(value) || 'Indica un número entero, mayor o igual que cero.', admin: { step: 1, description: 'Un único saldo para todas las fechas y orígenes del programa. Si se toman 3 de 15 cupos, cambia este saldo a 12. Vacío: sin cantidad informada; cero: sin cupos.' } },
      { name: 'lastSeats', label: 'Destacar «Últimos cupos» en todas las fechas', type: 'checkbox', defaultValue: false, admin: { description: 'Opcional. Actívalo cuando quieras destacar todas las fechas. También puedes destacar una fecha por separado desde Salidas. Con cero cupos no se muestra la etiqueta.' } },
      { name: 'seatsCheckedAt', label: 'Última revisión del saldo', type: 'date', index: true, access: { create: () => false, update: () => false }, admin: { readOnly: true } },
      { name: 'seatsConfirmed', label: 'Confirmo que el saldo y la etiqueta grupal siguen vigentes', type: 'checkbox', defaultValue: false, admin: { description: 'Confirma la disponibilidad en Meganet o con un asesor. Cambiar el saldo o marcar esta casilla renueva la revisión; se desmarca al guardar.' } },
      { name: 'seatsMigrationPending', label: 'Revisión pendiente de cupos anteriores', type: 'checkbox', defaultValue: false, access: { create: () => false, update: () => false }, admin: { readOnly: true, condition: data => data.seatsMigrationPending === true, description: 'Las fechas anteriores tenían cantidades distintas. Revisa el saldo del programa antes de informarlo; los datos anteriores se conservan en el respaldo de migración.' } },
      { name: 'legacySeatReferences', type: 'json', access: { create: () => false, update: () => false }, admin: { hidden: true } },
    ] },
    { name: 'flyer', label: 'Imagen del programa (opcional)', type: 'upload', relationTo: 'media', admin: { description: 'Ideal: 800 × 800 px. Admite otros tamaños y proporciones; se muestra completa dentro de una tarjeta cuadrada, sin recortar. Máximo 12 MB. Sin imagen se usa la de Megatravel en todas las fechas.' } },
    { name: 'flyerSourceUrl', label: 'O pegar enlace de imagen (HTTPS)', type: 'text', validate: urlValidation, admin: { description: 'Ideal: 800 × 800 px. Se admiten otros tamaños y proporciones. Se conserva el enlace si no se puede copiar la imagen.' } },
    { name: 'bookingUrl', label: 'Reservar en Meganet', type: 'text', validate: urlValidation },
    { name: 'descriptionUrl', label: 'Descriptivo en Café', type: 'text', validate: urlValidation },
  ],
}

export const AuditLog: CollectionConfig = {
  slug: 'audit-log', labels: { singular: 'Cambio', plural: 'Historial de cambios' },
  access: { read: isEditor, create: never, update: never, delete: never },
  admin: { group: 'Control', useAsTitle: 'program', defaultColumns: ['createdAt', 'program', 'event', 'actorLabel'], description: 'Registro de cambios comerciales, retiros y reactivaciones. Solo lectura.' },
  fields: [
    { name: 'departureId', label: 'Identificador de salida', type: 'text', required: true, index: true },
    { name: 'program', label: 'Programa', type: 'text', required: true },
    { name: 'event', label: 'Acción', type: 'select', required: true, options: [{ label: 'Creada', value: 'created' }, { label: 'Actualizada', value: 'updated' }, { label: 'Retirada', value: 'withdrawn' }, { label: 'Reactivada', value: 'reactivated' }, { label: 'Eliminada', value: 'deleted' }] },
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
    { name: 'seatsValidityHours', label: 'Vigencia de cupos referenciales (horas)', type: 'number', required: true, defaultValue: DEFAULT_SEATS_VALIDITY_HOURS, min: 1, max: MAX_SEATS_VALIDITY_HOURS, validate: (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= MAX_SEATS_VALIDITY_HOURS || 'Indica horas enteras entre 1 y 720.', admin: { step: 1, description: 'Al vencer se ocultan cantidad y «Últimos cupos» hasta una nueva revisión. La salida sigue publicada.' } },
  ],
}
