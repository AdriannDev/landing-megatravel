# Operación y lanzamiento

Para entender qué servicio contratar y por qué no hace falta un hosting web adicional si se utiliza Railway, consulta [producción y proveedores](produccion.md). El mapa de carpetas está en [arquitectura](arquitectura.md) y las variables/comandos en [configuración](configuracion.md). Este documento describe una etapa posterior; no implica que se hayan realizado estos pasos.

## Servicios y variables

Crear en la cuenta del proyecto una aplicación Railway con PostgreSQL, un bucket R2 y un servicio programado para los retiros. La configuración incluida no crea servicios ni compromete gastos. Cotizar el coste recurrente con las tarifas vigentes y el consumo estimado antes de contratar o desplegar.

La aplicación necesita `DATABASE_URL`, una clave `PAYLOAD_SECRET` aleatoria de 32 caracteres o más y `NEXT_PUBLIC_SITE_URL` con la URL definitiva HTTPS. Para R2: `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_PUBLIC_URL`. El bucket debe servir los archivos en una URL pública o dominio de medios. Los permisos de la clave R2 se limitan al bucket correspondiente. `NEXT_PUBLIC_GA4_ID` es opcional y se proporciona al build.

El contacto por defecto utiliza el enlace de WhatsApp publicado en [la web oficial de Megatravel Perú](https://www.megatravel.pe/es/), verificado el 23 de octubre de 2026. Confirma que sea el canal apropiado para este catálogo; el administrador puede modificarlo en Configuración del catálogo. El logo se referencia desde el recurso público vinculado por esa misma web.

`IMPORT_MEDIA_ALLOWED_HOSTS` contiene los hosts exactos permitidos para copiar archivos. Para el Excel recibido: `i.imgur.com,i.spread.name`. El importador no sigue redirecciones. Si se incorpora otro proveedor, un administrador debe añadir su host después de verificarlo.

## Preparación y corte

1. Usar Node compatible e instalar con `npm ci`. Ya existe `package-lock.json`, coherente con el manifiesto en esta revisión, y el Dockerfile usa `npm ci`. Versionar ambos archivos de dependencias cuando se modifiquen mediante npm.
2. Ejecutar pruebas unitarias, tipos, integración, build e inspección visual de escritorio y móvil.
3. En staging PostgreSQL, generar `npm run migrate:create -- inicial`. Revisar y versionar los archivos de `src/migrations`; ejecutar `npm run migrate` y verificar que la base vacía arranca correctamente. Producción tiene `push: false`.
4. Crear el primer administrador mediante `npm run bootstrap`, con variables temporales privadas. No exponer la pantalla de creación de primera cuenta. Retirar la contraseña del entorno después.
5. Ejecutar la validación CSV y revisar el reporte; importar con `--historical --commit`. Verificar recuentos por hoja/estado, los diez borradores y una muestra de precios, fechas, enlaces y flyers. No activar la opción histórica para operaciones diarias.
6. Comprobar que R2 conserva los archivos y sus enlaces de origen, y que las imágenes del catálogo abren completas. Revisar fallos de descarga; no sustituir archivos por imágenes de otro programa.
7. Probar una copia y restauración en una base separada. Verificar acceso, recuentos y enlaces de medios en la restauración.
8. Detener brevemente la edición de Sheets, exportar últimos cambios y repetir el importador conservando las claves. Establecer `CATALOG_SOURCE=cms` antes de la validación final.
9. Activar el dominio y comprobar `/api/health`, búsqueda por código/destino/fecha, URL compartida, reservas/descriptivos y ausencia de datos privados en `/api/public/catalog`.
10. Mantener SpreadSimple operativo durante la aceptación para volver al origen si la validación falla. Capacitar a editores con `docs/editores.md`.

No hay una migración SQL inicial generada y validada. En la primera implementación la red impidió instalar Payload; en la revisión documental ya existen dependencias locales, pero no se retoman los pendientes por instrucción del usuario. La migración, el build y las comprobaciones de staging siguen siendo condiciones del lanzamiento.

## Retiro programado

Configura un cron Railway `0 5 * * *` (UTC): equivale a las 00:00 de Lima. Usa el mismo código y base que la aplicación; comando `npm run retire`. La agenda debe configurarse en el servicio de tareas, sin mantenerlo como un servidor HTTP permanente. Alternativamente, un programador de confianza puede enviar `POST /api/cron/retire` con el bearer `CRON_SECRET` (mínimo 32 caracteres) desde su almacén de secretos. [Tareas cron de Railway](https://docs.railway.com/cron-jobs).

La consulta pública también calcula vigencia y no depende del cron. Una pestaña abierta refresca datos cada 30 segundos; el catálogo del servidor no tiene caché. Registrar y alertar sobre fallos del cron. La tarea solo retira registros todavía publicados y vencidos, y escribe historial con responsable Sistema.

## Copia y restauración

Requiere herramientas PostgreSQL `pg_dump` y `pg_restore` instaladas. Las credenciales se transmiten mediante variables de entorno, no argumentos ni archivos del repositorio.

```powershell
node --env-file=.env.local scripts/backup.mjs
# Crear previamente una base separada, por ejemplo megatravel_restore.
# Definir RESTORE_DATABASE_URL en el entorno privado y elegir el dump recién generado.
node --env-file=.env.local scripts/backup.mjs --restore backups/megatravel-FECHA.dump
```

La restauración rechaza la URL de origen y exige que el destino termine en `_restore`. Después, iniciar una instancia de prueba contra ese destino y verificar recuentos por estado, acceso por rol, historial, filtros y archivos. Los dumps no incluyen binarios de R2: mantener una copia independiente del bucket y del manifiesto, y probar que los enlaces almacenados siguen resolviendo. No se ejecutó una restauración en este entorno.

## Seguimiento

GA4 mide búsquedas sin resultados y derivaciones a reserva/descriptivo; validar los eventos en el depurador después de configurar la propiedad. Una reserva confirmada requiere una integración adicional con Meganet. Revisar semanalmente borradores incompletos, retiros próximos y fallos de descarga. Tras la migración, mantener el CMS como única fuente y utilizar CSV para intercambios masivos.
