# Guía de mantenimiento: dónde hacer cambios

## Elegir entre CMS y código

Cuando `CATALOG_SOURCE=cms`, el equipo actualiza precios, fechas, flyers, promociones y estados en `/admin`. Esos cambios van a la base y no generan commits.

El repositorio se modifica para cambiar diseño, comportamiento, permisos, campos o integraciones. Si se está revisando la instantánea `workbook`, el CMS no será la fuente visible. Consulta [configuración](configuracion.md) antes de concluir que un cambio de contenido no se refleja.

## Dónde hacer cada cambio

| Quiero cambiar… | Archivo o lugar principal | Revisar también |
| --- | --- | --- |
| Textos del hero, secciones, pie o buscador | `src/components/catalog.tsx` | `globals.css` si cambia la longitud o distribución |
| Colores, tipografía, espaciados y tamaños | `src/app/(catalog)/globals.css` | Sus reglas responsive y de movimiento reducido |
| Orden o contenido dentro de una tarjeta | `src/components/package-card.tsx` | Contrato público en `lib/types.ts`, proyección en `lib/catalog.ts` y estilos |
| Logo o contacto de respaldo | `src/lib/brand-config.ts` y `src/components/brand.tsx` | En modo CMS, el contacto real se edita en Configuración del catálogo |
| Contacto que aparece en el catálogo CMS | Global Configuración del catálogo en `/admin` | Valores por defecto solo si no hay configuración guardada |
| Título del navegador, descripción o icono | `src/app/(catalog)/layout.tsx` y `public/icon.svg` | Metadatos del preview se definen en su página |
| Banners reales y periodos | Colección Banners en `/admin` | Alternativa estática y versión móvil |
| Apariencia/controles de los banners | `src/components/campaign-banner.tsx` | CSS y preferencias de movimiento reducido |
| Número de tarjetas por página | `PAGE_SIZE` en `src/lib/catalog.ts` | Prueba de paginación y tamaños del catálogo |
| Orden por precio, duración o destacados | `filterCatalog()` en `src/lib/catalog.ts` | Opciones de orden en `catalog.tsx` |
| Filtros, etiquetas o selector móvil | `src/components/catalog.tsx` | `CatalogFilters`, parseo/serialización y pruebas |
| Retiro por defecto o validación de estados | `src/lib/lifecycle.ts` | Campo/default en `collections/content.ts`, importadores y documentación |
| Cálculo visible antes de guardar | `src/components/admin/cutoff-preview.tsx` | El cálculo real sigue estando en `lib/lifecycle.ts` |
| Formularios, columnas o un campo de Salidas | `src/collections/content.ts` | Tipos, normalización, preview, historial, CSV y migración del esquema |
| Usuarios, roles o cuenta propia del editor | `src/collections/users.ts` y `src/server/access.ts` | Autorización en herramientas y preview |
| Botones y herramientas del CMS | `src/components/admin/workspace-tools.tsx` | `api/admin-tools/[action]/route.ts` y `custom.css` |
| Aspecto del preview del formulario | `src/components/admin/card-preview.tsx` | Debe mantenerse coherente con la tarjeta pública |
| Preview de una salida guardada | `src/app/(catalog)/preview/[id]/page.tsx` | Reutiliza `PackageCard` y exige sesión |
| Campos públicos o respuesta del catálogo | `toPublicPackage()` y `src/server/catalog-service.ts` | `PublicPackage`, `CatalogData` y pruebas de privacidad |
| Descarga automática de flyers | `src/server/media-import.ts` y `src/server/hooks.ts` | `IMPORT_MEDIA_ALLOWED_HOSTS`, límites y advertencias |
| Columnas o transformación del Excel original | `scripts/prepare-workbook.mjs` | `scripts/read-xlsx.mjs`, datos normalizados y reporte |
| Formato de CSV o normalización de fechas/precios | `src/lib/csv.ts` y `src/lib/import-records.ts` | Importación, exportación y pruebas |
| Creación/actualización de filas CSV en la base | `src/server/import-service.ts` | Claves estables, transiciones e historial |
| A qué hora se ejecuta el cron | Configuración del servicio programado en Railway | La hora de retiro comercial sigue siendo la de `retirementAt()` |
| Qué salidas retira el cron | `src/server/retire-service.ts` | Hooks, estado y consulta pública |
| Conexión PostgreSQL o R2 | Variables del entorno y `src/payload.config.ts` | `src/server/payload.ts` y guía de producción |
| Cómo se ejecuta el contenedor | `Dockerfile`, `scripts/start.mjs` y `railway.toml` | Salida standalone y rutas de recursos |
| Comandos compartidos o versión de Node | `package.json` y `.nvmrc` | Lockfile si cambian dependencias y requisitos de Docker |
| Eventos de medición | `src/lib/analytics.ts` y llamadas desde componentes | Carga de GA4 en `layout.tsx` |

## Cambiar una regla de retiro

La implementación tiene una constante de 30 días en `lib/lifecycle.ts`, un default de formulario de 30 en `collections/content.ts` y defaults en la importación. Si se decide cambiar el valor general, hay que revisarlos juntos. También existen textos de ayuda y esta documentación.

Cambiar el default afecta a registros nuevos. No reescribe automáticamente la anticipación de las salidas ya guardadas. Para las existentes, la modificación de contenido debe realizarse deliberadamente desde el CMS o una operación de datos revisada.

Para una sola salida se cambia el campo «Retirar con anticipación», sin tocar código. El hook recalcula `withdrawalAt` al guardar. La consulta pública recalcula la vigencia por seguridad y no espera al cron para decidir si puede mostrarla.

Comprobaciones relevantes: 30/15/0 días, meses de diferente duración, año bisiesto, cambio de año y el instante exacto de las 00:00 de Lima. Las pruebas están en `tests/lifecycle.test.mjs`.

## Añadir un campo comercial

Ejemplo: incorporar un dato adicional que debe aparecer en la tarjeta.

1. Definirlo en `collections/content.ts`, con etiqueta, tipo, validación y permisos.
2. Regenerar `src/payload-types.ts` con `npm run generate:types`.
3. Incorporarlo al contrato `Departure` y a `cmsToDeparture()` si se necesita en la lógica propia.
4. Si será público, incorporarlo expresamente a `PublicPackage` y `toPublicPackage()`. Que un campo exista en el CMS no lo hace público.
5. Mostrarlo en `package-card.tsx` y ajustar estilos.
6. Revisar ambos previews: el del formulario y el de la salida guardada.
7. Añadirlo al listado `tracked` de `server/hooks.ts` si debe registrarse como cambio comercial.
8. Si debe copiarse al duplicar una salida, añadirlo al objeto `template` de la acción `duplicate`. Su selección de campos es explícita y conserva los tipos generados por Payload.
9. Si se importará/exportará, actualizar normalización, escritura y encabezados CSV.
10. Preparar y revisar la migración de PostgreSQL correspondiente antes del despliegue.

No se necesita añadir todo campo a todos los contratos. Un motivo de retiro, por ejemplo, debe permanecer privado y no requiere aparecer en una tarjeta.

## Añadir un filtro

El filtro necesita cuatro piezas coordinadas: valor disponible, estado de URL, comparación y control visual.

- Añadir el campo a `CatalogFilters` y a `emptyFilters()`.
- Incluirlo en `parseFilters()` y `serializeFilters()` para que compartir una URL reproduzca la selección.
- Definir la comparación en `filterCatalog()` respetando OR dentro del filtro y AND entre filtros.
- Añadir etiqueta, opciones, control y eliminación de chips en `FilterPanel`/`Catalog`.
- Si el dato no existe en la respuesta pública, adaptar primero modelo, normalización y proyección.
- Verificar búsqueda inicial, limpiar, atrás/adelante del navegador, resultado vacío, móvil y paginación reiniciada.

Los filtros actuales usan parámetros repetidos: `zones=EUROPA&zones=ASIA`. Cambiar sus nombres rompe la compatibilidad con enlaces compartidos antiguos, salvo que el parser admita ambos formatos.

## Añadir una acción administrativa

La interfaz está en `components/admin/workspace-tools.tsx`; la operación HTTP se añade al `route.ts` de `api/admin-tools/[action]`. Todas las escrituras deben pasar por `requireEditor(request, true)`.

Decidir por separado quién puede ejecutar la operación. Un editor puede gestionar contenido; una importación histórica incompleta está limitada a administradores en el endpoint actual. La autorización no puede depender solo de ocultar un botón.

Para escribir salidas, usar las operaciones de Payload con el usuario/solicitud apropiados, de forma que se apliquen hooks, acceso e historial. No sustituirlas por una escritura directa de SQL que omita esos pasos.

## Añadir un componente al panel

1. Crear el componente bajo `src/components/admin/`.
2. Registrarlo en `payload.config.ts` o en el campo/colección donde se vaya a usar, con su ruta y nombre exportado.
3. Ejecutar `npm run generate:importmap`.
4. Revisar el cambio generado en `app/(payload)/admin/importMap.js` y versionarlo si corresponde.
5. Mantener estilos del panel en `app/(payload)/custom.css`; los del catálogo van en otro archivo.

Un componente que use `useFormFields` recibe los valores del formulario, incluidos cambios sin guardar. No equivale a leer el último registro persistido de la base.

## Mantener la importación del Excel

`scripts/prepare-workbook.mjs` trabaja con posiciones de columna y el primer sheet como fuente activa. Si cambian el orden de hojas, los encabezados o las columnas, se debe revisar el mapeo antes de regenerar.

Conservar el archivo original. Ejecutar la preparación produce varios archivos derivados y puede cambiar también `src/data/catalog.json`; revisar el diff antes de incorporarlo a Git. No se debe regenerar la instantánea para modificar una sola tarifa cuando el CMS ya sea la fuente oficial.

La clave de una salida procedente del Excel combina MTPE, fecha, origen y destino. Cambiar uno de esos datos puede producir una nueva clave. Para actualizar una fila existente por CSV después del corte, conservar el `source_key` exportado por el CMS.

## Distinguir dos formas de descargar imágenes

| Camino | Destino del archivo | Uso |
| --- | --- | --- |
| `scripts/download-assets.mjs` | `public/flyers/`, con manifiesto en `migration/assets.json` | Preparación/revisión de la instantánea del Excel |
| `server/media-import.ts` mediante CMS/importador | Colección Imágenes y R2 si está configurado; en otro caso `MEDIA_DIR` o `media/` | Contenido administrado; requiere persistencia si se usa disco en producción |

Una descarga local a `public/flyers/` no carga por sí sola el archivo a R2. El cambio de un enlace en el formulario intenta copiar la imagen automáticamente; si falla, conserva su URL y muestra una advertencia.

## Cambios visuales y accesibilidad

Las tarjetas conservan el flyer completo con `object-fit: contain`. Cambiarlo a `cover` puede cortar textos comerciales. La ampliación utiliza el diálogo base, que también se usa en los filtros móviles.

Al cambiar tamaños, comprobar que las condiciones del precio, fechas, códigos y acciones sigan legibles. Conservar títulos de diálogo, texto alternativo, foco visible, textos para enlaces externos y `prefers-reduced-motion`.

## Qué regenerar y qué probar

| Tipo de cambio | Regeneración/comprobación pertinente |
| --- | --- |
| Solo documentación | Enlaces, rutas, comandos y coherencia con el código |
| Texto o CSS | Página afectada en escritorio y móvil; teclado si se cambian controles |
| Filtros, URL, orden | `tests/catalog.test.mjs` y comportamiento de la URL |
| Fechas, publicación o retiro | `tests/lifecycle.test.mjs` y posterior integración con Payload |
| CSV o normalización | `tests/import.test.mjs` y `tests/import-service.test.mjs` |
| Modelo de Payload | Tipos generados, migración de esquema y pruebas de integración |
| Nuevo componente administrativo | Mapa de importaciones y panel renderizado |
| Dependencias | Actualizar `package-lock.json` mediante npm y reinstalar con `npm ci` en otro entorno |
| Contenedor o despliegue | Build e inicio en staging cuando se retome esa etapa |

Los comandos completos están en [configuración](configuracion.md). Una revisión de sintaxis no valida permisos reales, consultas PostgreSQL ni aspecto visual.

## Documentación de cada cambio

Cada parte desarrollada debe incorporar su documentación en la misma entrega, según la indicación del usuario. Antes de considerarla terminada:

1. Actualizar la guía funcional o técnica afectada con el comportamiento resultante y cómo utilizarlo.
2. Registrar variables nuevas en `.env.example` y [configuración](configuracion.md), sin valores privados. Documentar comandos, migraciones y pasos operativos si cambian.
3. Actualizar [continuidad](continuidad.md) cuando se complete un pendiente, aparezca otro o cambie el orden de trabajo.
4. Registrar comprobaciones realmente ejecutadas, fecha, resultado y límites. Distinguir una implementación local de una integración validada en producción.
5. Añadir documentos nuevos al [índice](README.md) y mantener coherentes los enlaces y ejemplos existentes.

La documentación debe describir el estado final del cambio, con instrucciones reproducibles. Los reportes históricos se conservan con su fecha; no se usan como prueba de verificaciones posteriores.
