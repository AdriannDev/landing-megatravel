# Bloqueos Megatravel

Catálogo público y administración en español con Next.js, TypeScript, Tailwind, componentes shadcn/ui sobre Radix, Payload y PostgreSQL. Almacenamiento de imágenes compatible con Cloudflare R2. Las reservas y descriptivos continúan en los enlaces originales de Meganet y Café Megatravel.

El catálogo incluye búsqueda por programa, destino y MTPE; filtros combinables; campañas; carrusel accesible; ordenamiento; paginación; filtros móviles; contacto flotante por WhatsApp; enlaces externos y eventos GA4 opcionales. Programas comparte el contenido de un MTPE entre sus fechas; Nueva salida y Nueva fecha permiten guardar o publicar hasta 30 fechas en una transacción. Los programas sin imagen usan una imagen de Megatravel.

## Documentación del desarrollo

Empieza por el [índice de documentación](docs/README.md). Las guías están organizadas según la tarea:

| Necesito… | Guía |
| --- | --- |
| Saber qué está validado y qué falta para continuar | [Estado y próximos pasos](docs/continuidad.md) |
| Activar el CMS y crear la primera cuenta | [Configuración y uso del CMS](docs/cms.md) |
| Probar las funciones antes de desplegar en Railway | [Validación local](docs/pruebas-locales.md) |
| Comparar el alojamiento con el presupuesto de USD 20/mes | [Costos aproximados de Railway](docs/costos-railway.md) |
| Entender para qué sirve cada carpeta y archivo | [Arquitectura](docs/arquitectura.md) |
| Encontrar dónde cambiar diseño, filtros, tarjetas o reglas | [Mantenimiento](docs/mantenimiento.md) |
| Conocer campos, permisos, estados, CSV y endpoints | [Datos y API](docs/datos-y-api.md) |
| Configurar un equipo y entender las variables/comandos | [Configuración](docs/configuracion.md) |
| Elegir alojamiento y conectar mi dominio | [Producción y proveedores](docs/produccion.md) |
| Crear commits, hacer push y trabajar en varios equipos | [Git y GitHub](docs/github.md) |
| Realizar el corte y mantener el servicio | [Operación](docs/operacion.md) |
| Rotar credenciales, comparar almacenamiento y configurar copias | [Guía práctica de Railway](docs/guia-railway-operacion.md) |
| Administrar las salidas sin editar código | [Guía de editores](docs/editores.md) |

## Estado de la entrega

- Railway está conectado al repositorio y a PostgreSQL. El 4 de noviembre se comprobó el chequeo de salud y se configuró y probó el cron diario de retiros.
- Continúan pendientes la rotación de credenciales expuestas durante la revisión, la validación del almacenamiento de imágenes, las copias probadas, el correo y la migración de la configuración heredada de Railway. Ver [estado y próximos pasos](docs/continuidad.md) y [guía práctica de Railway](docs/guia-railway-operacion.md).
- El despliegue automático puede fallar: tras cada push revisa su estado en Railway. Los cambios de esquema requieren migraciones planificadas; la base, las imágenes y las claves no se guardan en Git.

## Arranque local

Requiere Node **24.22.1 o posterior**. En PowerShell usa `npm.cmd` si la política del equipo bloquea `npm.ps1`.

```powershell
Copy-Item .env.example .env.local
npm.cmd ci
```

Configura una clave aleatoria `PAYLOAD_SECRET` de al menos 32 caracteres. No utilices los ejemplos como credenciales. La red debe permitir `registry.npmjs.org` y los hosts de imágenes.

Para revisar el catálogo con datos del Excel, sin conectar un CMS:

```powershell
npm.cmd run dev
```

Abre `http://localhost:3000`. `CATALOG_SOURCE=workbook` activa explícitamente la instantánea preparada. El servidor comprueba en cada consulta la fecha de retiro. Las imágenes se leen desde sus URLs originales hasta que se descarguen.

Para probar el CMS completo con SQLite local, deja `DATABASE_URL` vacío, cambia `USE_SQLITE=true` y `CATALOG_SOURCE=cms`. Para PostgreSQL local, usa `docker compose up -d`, deja `USE_SQLITE=false` y configura `DATABASE_URL` como en el ejemplo.

`npm run dev` prepara el esquema de SQLite antes de iniciar Next.js. En bases anteriores, añade `settings_blog_posts.image_id` antes de reconstruir la tabla para admitir artículos sin fecha. También prepara las columnas de salidas destacadas para completar sus relaciones en esa misma actualización. Guarda un respaldo en `backups/` y comprueba que se conserven datos, índices e integridad; no borres la base si aparece `no such column: "image_id"`. Puedes verificar este proceso con `npm run test:local-schema`, que utiliza una base aislada en `.qa/`.

El procedimiento completo de primera cuenta, variables privadas, importación, acceso y archivos está en [configuración del CMS](docs/cms.md). Cada parte desarrollada debe actualizar su documentación y sus resultados de validación; ver [mantenimiento](docs/mantenimiento.md#documentación-de-cada-cambio).

```powershell
# Define ADMIN_EMAIL y ADMIN_PASSWORD en .env.local; contraseña de al menos 14 caracteres.
npm.cmd run bootstrap
npm.cmd run import:cms -- --historical --skip-images
npm.cmd run import:cms -- --historical --commit
npm.cmd run dev
```

El primer comando de importación valida sin escribir. El segundo importa y descarga automáticamente los flyers. Si una imagen falla, la fila conserva el enlace y el reporte indica el fallo. Retira `ADMIN_PASSWORD` del archivo una vez creada la cuenta. Accede a `/admin`. El registro público de administradores está bloqueado.

## Datos y descargas desde el Excel

El original `Bloqueos aereos (1).xlsx` no se modifica. La extracción usa solo Node y no ejecuta macros ni fórmulas.

```powershell
node scripts/prepare-workbook.mjs "Bloqueos aereos (1).xlsx"
node scripts/download-assets.mjs
node scripts/prepare-workbook.mjs "Bloqueos aereos (1).xlsx"
```

El primer paso genera el CSV para Payload, registros normalizados, reporte por hoja y lista única de imágenes. El segundo copia los archivos a `public/flyers`, con nombres estables derivados del enlace y un manifiesto. El tercero incorpora las copias locales al catálogo de revisión. Para el CMS, la importación CSV descarga las imágenes directamente a la colección Imágenes y R2 cuando está configurado; no hace falta subirlas una por una.

Los históricos conservan estado, motivo y observaciones disponibles. Los retiros sin responsable u hora fiable conservan la fecha y el valor original de Excel en Procedencia. No se atribuyen a un editor ni se inventan horas. La creación del registro en el CMS tiene su propia fecha y responsable de importación.

El importador actualiza por `source_key`, detecta claves repetidas y reporta errores por fila. No reactiva automáticamente registros que el equipo ya retiró en el CMS. Para nuevos CSV, exporta desde el panel y conserva las claves. Los campos son `source_key`, `source_sheet`, `source_ref`, `program`, `mtpe`, `destination`, `zone`, `origin`, `days`, `nights`, `travel_date`, `price`, `currency`, `price_condition`, `flyer_url`, `booking_url`, `description_url`, `promotions`, `cruise_line`, `advance_days`, `status`, `withdrawal_reason`, `withdrawal_note`, `retired_at`, `source_retirement_date`, `source_retirement_raw`. Varias promociones se separan con `|`. Estados: `draft`, `published`, `withdrawn`.

## Reglas de publicación y privacidad

- Retiro = salida menos anticipación; 30 días por defecto, entero configurable de 0 a 3650. El corte es a las **00:00 de America/Lima**.
- La API pública filtra por estado y vigencia aunque el cron se retrase. No utiliza caché. Las pestañas abiertas consultan cambios cada 30 segundos.
- Retiro manual con motivo; «Otro» exige observación. Reactivación con revisión de precio, enlaces y vigencia. No se puede eludir la revisión pasando por borrador.
- Historial de cambios y versiones privados. Salidas, usuarios y configuración no tienen lectura anónima en la API de Payload. `/api/public/catalog` usa una lista explícita de campos comerciales.
- Editores gestionan contenido. Solo administradores gestionan usuarios y configuración. El historial no permite modificaciones ni borrados desde el panel.
- Descargas remotas limitadas a hosts configurados, HTTPS, sin redirecciones, hasta 12 MB y con validación de firma de imagen.
- GA4 usa `booking_click`, `description_click` y `search_no_results`. Este último registra la forma de la búsqueda sin enviar su texto libre. Los clics son derivaciones, no reservas confirmadas.

## Verificación

```powershell
npm.cmd test
npm.cmd run check:source
npm.cmd run check:domain
npm.cmd run typecheck
npm.cmd run test:integration
npm.cmd run build
```

`npm test` ejecuta pruebas del dominio sin dependencias externas: fechas, plazos, transiciones, filtros, URL, privacidad, precios, CSV, duplicados y conciliación con el Excel. La prueba de conciliación usa el archivo fuente local; el resto se ejecuta sin él. `test:integration` crea una SQLite aislada bajo `.qa`, con usuarios y registros exclusivamente de prueba; comprueba permisos, historial, reactivación e importación repetida. No utiliza la base de producción.

`check:source` comprueba sintaxis; no sustituye `typecheck` ni `build`. El equipo debe revisar escritorio y móvil, teclado, contraste, visor, filtros, enlaces reales y controles táctiles con el servidor funcionando antes de publicar. El comando de integración y el build requieren instalar las dependencias.

## Despliegue y operación

Consulta [la guía de Railway, R2 y lanzamiento](docs/operacion.md) y [la guía del editor](docs/editores.md). `Dockerfile`, `railway.toml` y `compose.yaml` preparan los servicios; se necesitan las credenciales propias del proyecto y una migración inicial verificada. Después del corte a CMS, establece `CATALOG_SOURCE=cms` y deja de editar el Excel como fuente principal.

La arquitectura elegida utiliza Next.js con Payload como CMS, PostgreSQL para producción y Railway como alojamiento, con imágenes en R2 o un volumen persistente mediante `MEDIA_DIR=/app/media`. El dominio puede permanecer en su registrador. Empieza por [configuración del CMS](docs/cms.md) y [pruebas locales](docs/pruebas-locales.md); los requisitos de lanzamiento están en [producción](docs/produccion.md) y el [presupuesto](docs/costos-railway.md) recoge los supuestos frente a USD 20/mes.

## Commits iniciales y GitHub

Los dos commits iniciales ya existen en esta copia. El siguiente script se conserva como herramienta de inicialización; no repetirlo para guardar los cambios actuales. Para continuar con commits normales, consultar [Git y GitHub](docs/github.md).

```powershell
# Revisión sin escrituras en el índice.
npm.cmd run prepare:commits -- --plan
# Crear los commits desde tu terminal habitual.
npm.cmd run prepare:commits
```

El script separa base del proyecto y documentación. No hace push ni configura `origin`. Las claves reales, bases locales, cachés, Excel original y respaldos están excluidos. Los datos normalizados de migración sí forman parte de esta entrega para el repositorio privado. Consulta [el flujo completo para vincular y clonar](docs/github.md).

Referencias técnicas: [Payload en Next.js](https://payloadcms.com/docs/getting-started/installation), [PostgreSQL](https://payloadcms.com/docs/database/postgres), [R2 a través del adaptador S3](https://payloadcms.com/docs/upload/storage-adapters).
