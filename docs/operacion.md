# Operación y lanzamiento

Para una prueba inicial sin programas, sigue [Railway: prueba con catálogo vacío](railway-prueba-vacia.md). Para entender qué servicio contratar y por qué no hace falta un hosting web adicional si se utiliza Railway, consulta [producción y proveedores](produccion.md). El mapa de carpetas está en [arquitectura](arquitectura.md) y las variables/comandos en [configuración](configuracion.md). Este documento describe una etapa posterior; no implica que se hayan realizado estos pasos.

## Servicios y variables

Preparar en la cuenta del proyecto una aplicación Railway con PostgreSQL, almacenamiento persistente y una tarea programada de retiros. El almacenamiento puede ser R2 o un volumen de la aplicación en `/app/media` con `MEDIA_DIR=/app/media` y `R2_BUCKET` vacío. La configuración incluida no crea servicios ni compromete gastos. Comparar el [presupuesto recurrente](costos-railway.md) y validar la opción elegida antes del corte.

La aplicación necesita `DATABASE_URL`, una clave `PAYLOAD_SECRET` aleatoria de 32 caracteres o más y `NEXT_PUBLIC_SITE_URL` con la URL definitiva HTTPS. Para R2: `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_PUBLIC_URL`. El bucket debe servir los archivos en una URL pública o dominio de medios. Los permisos de la clave R2 se limitan al bucket correspondiente. `NEXT_PUBLIC_GA4_ID` es opcional y se proporciona al build.

El contacto por defecto utiliza el enlace de WhatsApp publicado en [la web oficial de Megatravel Perú](https://www.megatravel.pe/es/), verificado el 23 de octubre de 2026. Confirma que sea el canal apropiado para este catálogo; el administrador puede modificarlo en Configuración del catálogo. El botón flotante utiliza ese mismo enlace y solo aparece si apunta a un dominio de WhatsApp admitido. El logo se referencia desde el recurso público vinculado por esa misma web.

`IMPORT_MEDIA_ALLOWED_HOSTS` contiene los hosts exactos permitidos para copiar archivos. Para el Excel recibido: `i.imgur.com,i.spread.name`. El importador no sigue redirecciones. Si se incorpora otro proveedor, un administrador debe añadir su host después de verificarlo.

## Preparación y corte

1. Usar Node compatible e instalar con `npm ci`. Ya existe `package-lock.json`, coherente con el manifiesto en esta revisión, y el Dockerfile usa `npm ci`. Versionar ambos archivos de dependencias cuando se modifiquen mediante npm.
2. Ejecutar pruebas unitarias, tipos, integración, build e inspección visual de escritorio y móvil.
3. En staging PostgreSQL, revisar las migraciones existentes en `src/migrations`, ejecutar `npm run migrate` y verificar que la base vacía arranca correctamente. Producción tiene `push: false`; no se debe generar otra migración inicial para una base nueva.
4. Crear el primer administrador mediante `npm run bootstrap`, con variables temporales privadas. No exponer la pantalla de creación de primera cuenta. Retirar la contraseña del entorno después.
5. Ejecutar la validación CSV y revisar el reporte; importar con `--historical --commit`. Verificar recuentos por hoja/estado, los diez borradores y una muestra de precios, fechas, enlaces y flyers. No activar la opción histórica para operaciones diarias.
6. Comprobar que R2 conserva los archivos y sus enlaces de origen, y que las imágenes se muestran completas en el catálogo. Revisar fallos de descarga; no sustituir archivos por imágenes de otro programa.
7. Probar una copia y restauración en una base separada. Verificar acceso, recuentos y enlaces de medios en la restauración.
8. Detener brevemente la edición de Sheets, exportar últimos cambios y repetir el importador conservando las claves. Establecer `CATALOG_SOURCE=cms` antes de la validación final.
9. Activar el dominio y comprobar `/api/health`, búsqueda por código/destino/fecha, URL compartida, reservas/descriptivos y ausencia de datos privados en `/api/public/catalog`.
10. Mantener SpreadSimple operativo durante la aceptación para volver al origen si la validación falla. Capacitar a editores con `docs/editores.md`.

Existe una migración inicial y migraciones posteriores en `src/migrations`. La cadena requiere validación con el adaptador de Payload y PostgreSQL real en staging; las pruebas con SQLite o PostgreSQL embebido no sustituyen esa validación. Siguen pendientes la verificación del contenedor y staging, correo, archivos de producción y restauración. Ver [estado actual](continuidad.md) y [arranque del CMS](cms.md).

## Tareas automáticas: retiros y Mega Blog

En Railway, `retiros-automaticos` ejecuta `0 5 * * *` UTC, equivalente a las 00:00 de Lima. Utiliza la imagen `node:24-bookworm-slim`, sin healthcheck HTTP, y termina tras enviar `POST /api/cron/retire` a la aplicación. `RETIRE_URL` apunta a ese endpoint y `CRON_SECRET` referencia la variable del servicio `landing-megatravel`; el secreto no se guarda en el repositorio. La aplicación realiza el retiro en su propia base. [Tareas cron de Railway](https://docs.railway.com/cron-jobs).

El comando de inicio configurado en el servicio es:

```sh
node -e "fetch(process.env.RETIRE_URL,{method:'POST',headers:{Authorization:'Bearer '+process.env.CRON_SECRET},signal:AbortSignal.timeout(120000)}).then(async r=>{const b=await r.json();console.log(JSON.stringify({httpStatus:r.status,checked:b.checked,withdrawn:b.withdrawn,errors:b.errors}));if(!r.ok)process.exitCode=1}).catch(e=>{console.error('retirement_request_failed',e.message);process.exitCode=1})"
```

Para comprobarlo, consulta `railway cron list --service retiros-automaticos --environment production` y los logs del servicio. Una ejecución manual con `railway cron run --service retiros-automaticos --environment production --yes` también procesa las salidas vencidas reales. Si se cambia el dominio, actualiza `RETIRE_URL`; al rotar el secreto, actualiza el servicio web y vuelve a desplegar el cron para que use la referencia actualizada. También es posible ejecutar `npm run retire` en un entorno privado con las variables del CMS y acceso a la base.

La misma ejecución también mantiene la sección **Mega Blog**. El cron se ejecuta todos los días por los retiros, pero la aplicación consulta `https://www.megatravel.pe/es/blog` solo cuando han transcurrido cinco días desde la última sincronización correcta. Prepara seis artículos recientes y sus miniaturas WebP de hasta 960 × 600 px, calidad 80, en la biblioteca Media y el almacenamiento ya configurado. Las copias se reutilizan por URL de origen. El catálogo las presenta en un carrusel manual de tres cards en escritorio, dos en tablet y una en móvil. Si falla la fuente o una imagen, conserva las cards y la fecha anteriores y vuelve a intentarlo con la siguiente ejecución diaria.

Para activar los destacados y las miniaturas en un entorno existente, aplicar primero la migración `20261112_220707_featured_departures_and_blog_images` con `npm run migrate` en PostgreSQL (en SQLite local: `npm run db:prepare:local`). Después ejecutar una vez `npm run sync:blog` desde el entorno privado correspondiente para poblar las seis cards y sus miniaturas sin esperar cinco días. Las dos selecciones destacadas empiezan vacías.

Un administrador también puede entrar en **Configuración del catálogo → Mega Blog → Actualizar ahora**. El botón busca los seis artículos y prepara sus imágenes sin esperar cinco días; muestra el progreso y el resultado, y renueva las cards y la fecha en el formulario. Guarda primero los cambios pendientes de configuración. Una actualización manual correcta inicia de nuevo el periodo de cinco días; si falla, conserva el contenido anterior y permite reintentar. No cambia las salidas destacadas ni el resto de la configuración.

No hace falta crear otro cron ni otra variable en Railway. Después del primer despliegue, para poblar las cards sin esperar a la siguiente ejecución diaria, lanzar una vez:

```sh
railway cron run --service retiros-automaticos --environment production --yes
```

Para poblarlas en el entorno local de SQLite, con el servidor detenido o en otra terminal, ejecutar:

```sh
npm run sync:blog
```

La consulta pública también calcula vigencia y no depende del cron. Una pestaña abierta refresca datos cada 30 segundos; el catálogo del servidor no tiene caché. Registrar y alertar sobre fallos del cron. La tarea solo retira registros todavía publicados y vencidos, y escribe historial con responsable Sistema.

## Copia y restauración

Requiere herramientas PostgreSQL `pg_dump` y `pg_restore` instaladas. Las credenciales se transmiten mediante variables de entorno, no argumentos ni archivos del repositorio.

```powershell
node --env-file=.env.local scripts/backup.mjs
# Crear previamente una base separada, por ejemplo megatravel_restore.
# Definir RESTORE_DATABASE_URL en el entorno privado y elegir el dump recién generado.
node --env-file=.env.local scripts/backup.mjs --restore backups/megatravel-FECHA.dump
```

La restauración rechaza la URL de origen y exige que el destino termine en `_restore`. Después, iniciar una instancia de prueba contra ese destino y verificar recuentos por estado, acceso por rol, historial, filtros y archivos. Los dumps no incluyen los binarios de imágenes: mantener una copia independiente del bucket R2 o del volumen de `MEDIA_DIR`, y probar que los enlaces almacenados siguen resolviendo. No se ejecutó una restauración en este entorno.

## Seguimiento

GA4 mide búsquedas sin resultados y derivaciones a reserva/descriptivo; validar los eventos en el depurador después de configurar la propiedad. Una reserva confirmada requiere una integración adicional con Meganet. Revisar semanalmente borradores incompletos, retiros próximos y fallos de descarga. Tras la migración, mantener el CMS como única fuente y utilizar CSV para intercambios masivos.
