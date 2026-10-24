# Configuración local y comandos

## Requisitos y archivos compartidos

El proyecto declara Node **24.22.1 o posterior**. `.nvmrc` propone 24.22.1 para mantener una referencia común entre ordenadores. El 24 de octubre de 2026 se actualizó la instalación global de Windows de 24.19.0 a **24.22.1 LTS**, con npm **11.19.1**. Los resultados de comprobación y los pendientes de producción están en [continuidad](continuidad.md).

Se comparten `package.json` y `package-lock.json`. El lockfile existente coincide con las dependencias declaradas en esta revisión. Usar `npm ci` para reinstalar la misma resolución de paquetes. `node_modules/` no se copia ni se sube a Git.

Se necesita Git para sincronizar el código. Docker es opcional para ejecutar PostgreSQL local mediante Compose. Los comandos de respaldo necesitan además las herramientas PostgreSQL `pg_dump` y `pg_restore`.

## Actualizar Node.js y comprobar Next.js

**Node.js** es el motor que ejecuta la aplicación y npm. **Next.js** es una dependencia del proyecto, declarada en `package.json` y fijada en el lockfile. Cada uno tiene su versión y procedimiento de actualización.

En esta revisión Next.js **16.4.3** ya era la última versión estable publicada en npm. También está dentro del rango compatible de `@payloadcms/next@3.90.2`, que admite Next desde 16.3.3 y anterior a 17 para esta rama. La actualización pendiente era la instalación de Node del ordenador. [Release Next 16.4.3](https://github.com/vercel/next.js/releases/tag/v16.4.3) y [Node 24.22.1 LTS](https://nodejs.org/en/blog/release/v24.22.1).

Para otro ordenador Windows con esta misma arquitectura x64:

1. Descargar el instalador MSI x64 de Node 24.22.1 desde [Node.js](https://nodejs.org/en/download), o una versión LTS posterior compatible con el proyecto.
2. Verificar la firma OpenJS Foundation y el SHA256 de la publicación oficial. El instalador de esta sesión se guardó en `.qa/`, excluida de Git y Docker.
3. Ejecutar el instalador con permisos de administrador si la instalación existente está en `C:\Program Files\nodejs`. El intento sin elevación devolvió el error Windows Installer 1730; la ejecución elevada completó con código 0 y sin reiniciar Windows.
4. Abrir una terminal nueva y reiniciar los servidores de desarrollo para que los procesos nuevos utilicen el motor actualizado.
5. Comprobar las versiones y ejecutar las verificaciones del proyecto.

```powershell
node --version
npm.cmd --version
npm.cmd ls next @payloadcms/next
npm.cmd test
npm.cmd run typecheck
npm.cmd run test:integration
npm.cmd run build
```

Para comprobar una futura versión de Next, consultar `npm.cmd view next version` y los `peerDependencies` de la versión de Payload utilizada. Cuando corresponda actualizar dependencias, usar npm para actualizar conjuntamente manifiesto y lockfile y repetir las verificaciones; no editar solo el número de versión de un archivo. Cambiar Node o Next no reduce por sí mismo la memoria permanente facturada por Railway; ver [presupuesto](costos-railway.md).

## Primera configuración en un ordenador

```powershell
# Ejecutar dentro de la carpeta del proyecto ya clonado.
npm.cmd ci
Copy-Item .env.example .env.local
```

El comando de copia es para la primera configuración; no se debe volver a ejecutarlo encima de un `.env.local` ya configurado. Cambiar los valores necesarios antes de iniciar el CMS. En otros shells normalmente se utiliza `npm`; en PowerShell, `npm.cmd` evita depender de la política de ejecución de `npm.ps1`.

El archivo `.env.local` pertenece a ese ordenador y está ignorado por Git. No se incluye en los commits ni se obtiene con `git pull`. Las credenciales reales de producción se configuran en el proveedor de alojamiento.

## Tres modos de trabajo

| Modo | Variables principales | Qué permite |
| --- | --- | --- |
| Catálogo con Excel preparado | `CATALOG_SOURCE=workbook` | Revisar la instantánea pública y sus enlaces sin importar datos en CMS |
| CMS con SQLite local | `CATALOG_SOURCE=cms`, `USE_SQLITE=true`, `DATABASE_URL` vacía | Probar edición y persistencia local; no se utiliza en producción |
| CMS con PostgreSQL | `CATALOG_SOURCE=cms`, `USE_SQLITE=false`, `DATABASE_URL` válida | Desarrollo/staging con la arquitectura de base prevista para producción |

En desarrollo sin base configurada y sin SQLite habilitado, el servicio también puede seleccionar la instantánea por defecto. En producción no existe ese fallback implícito: debe haber PostgreSQL para el CMS o elegirse explícitamente el modo instantánea.

La pantalla de catálogo en modo `workbook` no necesita consultar Payload, pero `/admin` sí necesita base y configuración. Se puede ver el catálogo sin que eso acredite la disponibilidad del panel.

Para completar la primera cuenta, importar y comprobar el panel, seguir [configuración y uso del CMS](cms.md). El [estado de continuación](continuidad.md) identifica los pendientes actuales.

## Variables de entorno

| Variable | Uso | Dónde se configura |
| --- | --- | --- |
| `NODE_ENV` | Distingue desarrollo, test y producción | Lo gestionan Next, los scripts o el contenedor |
| `NEXT_PUBLIC_SITE_URL` | URL pública, origen permitido y referencias del CMS | Local: `http://localhost:3000`; producción: URL HTTPS definitiva |
| `PAYLOAD_SECRET` | Firma/autenticación de Payload | Secreto aleatorio de al menos 32 caracteres; mantener estable en cada entorno |
| `DATABASE_URL` | Conexión PostgreSQL | Credencial del entorno; obligatoria para el CMS en producción |
| `USE_SQLITE` | Habilita SQLite si vale `true` y no es producción | Solo desarrollo/test |
| `SQLITE_URL` | Archivo o conexión SQLite local | Default `file:./megatravel.db`; las pruebas usan `.qa/` |
| `CATALOG_SOURCE` | Selección de instantánea o CMS | Usar `workbook` para la instantánea y `cms` para operación del CMS |
| `ADMIN_EMAIL` | Cuenta inicial y atribución del importador CLI | Entorno privado; no es una cuenta predeterminada del sistema |
| `ADMIN_PASSWORD` | Contraseña inicial del bootstrap | Al menos 14 caracteres; retirar después de crear el administrador |
| `MEDIA_DIR` | Directorio de cargas cuando no está activo R2 | Local: `media/` por defecto; Docker: `/app/media`; montar volumen persistente si se usa en producción |
| `R2_BUCKET` | Bucket de imágenes | Activa el adaptador de almacenamiento S3 en Payload |
| `R2_ENDPOINT` | Endpoint S3 de R2 para cargas | Valor de la cuenta R2; no confundir con la URL pública de imágenes |
| `R2_ACCESS_KEY_ID` | Identificador de acceso al bucket | Secreto en el proveedor/entorno privado |
| `R2_SECRET_ACCESS_KEY` | Clave de acceso al bucket | Secreto; nunca se incluye en el navegador |
| `R2_PUBLIC_URL` | Base pública para mostrar los archivos | Dominio público de medios del bucket |
| `IMPORT_MEDIA_ALLOWED_HOSTS` | Hosts exactos permitidos para descargar imágenes | Lista separada por comas; inicialmente `i.imgur.com,i.spread.name` |
| `CRON_SECRET` | Autenticación del endpoint de retiros | Secreto de al menos 32 caracteres; necesario si se usa HTTP, no para ejecutar el CLI interno |
| `NEXT_PUBLIC_GA4_ID` | Propiedad de medición opcional | Identificador público GA4; requiere rebuild cuando cambie el valor usado por el frontend |
| `RESTORE_DATABASE_URL` | Base separada para una restauración de prueba | Debe ser distinta del origen y terminar en `_restore` |
| `PORT` | Puerto HTTP asignado por el proveedor | Lo proporciona el alojamiento; el servidor standalone lo utiliza |
| `HOSTNAME` | Dirección de escucha | El script de producción establece `0.0.0.0` |

Las variables que comienzan con `NEXT_PUBLIC_` pueden incorporarse al código del navegador. No se deben usar para contraseñas, cadenas de conexión ni claves de R2.

El `Dockerfile` recibe `NEXT_PUBLIC_SITE_URL` y `NEXT_PUBLIC_GA4_ID` como argumentos de build. Los secretos de Payload y de almacenamiento son variables privadas de ejecución; no se deben introducir como argumentos persistidos en la imagen. El secreto de ejemplo del paso de build es temporal y no sustituye la clave real en producción.

## Comandos disponibles

| Comando | Efecto | ¿Escribe datos/archivos? |
| --- | --- | --- |
| `npm run dev` | Inicia Next en desarrollo usando webpack | Genera caché en `.next/` |
| `npm run build` | Genera el mapa de importaciones y compila la salida standalone | Sí: mapa y `.next/`; completado localmente con Node 24.22.1 el 24 de octubre, sin advertencias de compilación |
| `npm start` | Ejecuta `scripts/start.mjs` y el servidor standalone | Necesita un build completo y recursos preparados |
| `npm run bootstrap` | Crea el primer administrador | Sí, en la base; rechaza hacerlo si ya hay usuarios |
| `npm run generate:types` | Regenera tipos desde el modelo Payload | Sí, `src/payload-types.ts` |
| `npm run generate:importmap` | Regenera el mapa de componentes del panel | Sí, `admin/importMap.js` |
| `npm run migrate:create -- inicial` | Genera archivos de cambio de esquema | Sí, archivos de `src/migrations/` que deben revisarse |
| `npm run migrate` | Aplica migraciones disponibles | Sí, esquema de la base configurada |
| `npm run import:workbook -- "archivo.xlsx"` | Prepara el contenido del Excel | Sí, `migration/` y `src/data/catalog.json` |
| `node scripts/read-xlsx.mjs "archivo.xlsx"` | Inspecciona la estructura del libro | Lectura; no modifica el original |
| `node scripts/download-assets.mjs` | Descarga flyers de la lista preparada | Sí, `public/flyers/` y reportes/manifiesto |
| `npm run import:cms -- --historical --skip-images` | Valida la importación inicial sin copiar imágenes | Escribe el reporte, no los registros de contenido |
| `npm run import:cms -- --historical --commit` | Importa los datos y trata de copiar imágenes | Sí, base, medios y reporte |
| `npm run retire` | Ejecuta retiros vencidos | Sí, estado e historial de salidas que corresponda retirar |
| `npm test` | Pruebas del dominio e importación | Lectura y dobles de persistencia; no usa la base de producción |
| `npm run check:source` | Sintaxis con TypeScript | No equivale a compilar toda la aplicación |
| `npm run check:domain` | Comprueba tipos de las reglas independientes | No prueba interfaces ni adaptadores de base |
| `npm run typecheck` | Comprueba tipos del proyecto | Puede actualizar caché de TypeScript |
| `npm run test:integration` | Verifica operaciones con Payload en SQLite aislada | Sí, una base de prueba bajo `.qa/` |
| `npm run backup` | Crea un dump de PostgreSQL | Sí, archivo en `backups/` |
| `npm run restore:test -- backups/archivo.dump` | Restaura en la base separada indicada | Sí, base de prueba; requiere destino existente |
| `node scripts/check-repository.mjs` | Revisa rutas y patrones de secretos del índice de Git | Solo lectura; no es una auditoría exhaustiva |
| `npm run check:repository -- --working-tree` | Revisa también los archivos candidatos aún sin preparar | Solo lectura |
| `npm run prepare:commits -- --plan` | Comprueba la preparación de los commits sin crearlos | Solo lectura |
| `npm run prepare:commits` | Crea los commits locales previstos | Sí, historial de Git; no configura remoto ni hace push |

`bootstrap`, `import:cms`, `test:integration`, `migrate:create` y `migrate` cargan `.env.local` si existe; también aceptan variables ya proporcionadas por el servicio. `backup` y `restore:test` siguen exigiendo ese archivo en sus comandos npm. Next carga sus archivos de entorno de desarrollo. `retire` espera variables ya proporcionadas por el servicio programado.

Para ejecutar manualmente el retiro en local con ese archivo, la forma explícita es:

```powershell
node --env-file=.env.local --import=tsx scripts/retire.ts
```

Las funciones de Payload/CLI también pueden tener su propio manejo de entorno; no conviene depender de que una variable escrita en otro terminal esté disponible en el actual.

## PostgreSQL local

```powershell
docker compose up -d
```

`compose.yaml` expone PostgreSQL únicamente en `127.0.0.1:5432` y utiliza el volumen `postgres_data`. El usuario, contraseña y base del ejemplo son para desarrollo. El contenedor de base no inicia Next ni importa datos por sí solo.

La configuración permite sincronizar esquema en desarrollo. En producción `push` está deshabilitado, por lo que se deben generar, revisar y aplicar las migraciones antes de depender de tablas nuevas.

## Archivos que no viajan al otro ordenador

Al clonar el repositorio no aparecen `.env.local`, bases SQLite, el volumen PostgreSQL, el Excel original, cargas de `media/`, respaldos ni las cachés. Los datos normalizados y la instantánea que estén versionados sí se obtienen con el código.

Para trabajar con contenido compartido se necesita una base/almacenamiento del entorno correspondiente. No se debe apuntar el desarrollo cotidiano contra producción por comodidad: crear un entorno de desarrollo o staging con sus propias credenciales y datos.

## Inicio standalone y recursos

`npm start` no inicia `next dev` ni crea el build: ejecuta `.next/standalone/server.js` mediante un proceso hijo y reenvía señales de cierre. El `Dockerfile` copia allí `public/` y `.next/static/` para que los recursos se sirvan correctamente.

El proceso de producción de este repositorio está preparado alrededor del contenedor. Ejecutar el servidor standalone a mano después de un build local puede requerir preparar esas mismas copias de recursos; el comando `npm start` por sí solo no las realiza. Este detalle debe comprobarse cuando se retome la validación del build.

El contenedor fija `MEDIA_DIR=/app/media` para que sus scripts y el servidor standalone usen una ruta común aunque tengan distinto directorio de trabajo. Sin R2, hay que montar el volumen allí y verificar permisos; crear la carpeta en la imagen no le da persistencia por sí solo.
