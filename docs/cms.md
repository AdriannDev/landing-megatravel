# Configurar y empezar a usar el CMS

Payload ya está integrado en la aplicación. Su panel es `http://localhost:3000/admin` en local y `https://tu-dominio/admin` después del despliegue. No hay una cuenta ni una contraseña predeterminadas. Esta guía prepara el acceso; el uso diario está en [editores](editores.md).

## CMS del proyecto: Payload

El usuario confirmó **Payload como CMS del proyecto**. La configuración y el desarrollo continúan sobre su panel, adaptado a los usuarios no técnicos y al trabajo del equipo comercial: precios, fechas, imágenes, publicación, retiros, permisos e historial privado.

El editor necesita ver Salidas, Imágenes, Promociones y Banners, con formularios claros para precio, fecha, flyer y estado. El código, esquema de base y despliegues quedan en el trabajo del desarrollador. El proyecto ya incorpora español, pestañas comerciales, vistas por estado, previews, duplicación y varias fechas; faltan la prueba de uso por navegador y los ajustes que revele el equipo.

Payload permite aplicar los permisos y proteger los campos/historial privados previstos sin una tarifa por cada editor en esta implementación. El desarrollador mantiene la aplicación y su configuración; el equipo comercial administra el contenido desde el panel.

Con 1,000 visitantes mensuales, el rendimiento del catálogo debe validarse junto con la entrega pública y las imágenes. El catálogo actual continúa siendo dinámico. Caché/publicación estática y optimización de flyers son trabajos separados que deben conservar los retiros y la actualización de precios. El consumo de la implementación depende de sus procesos, no de una licencia por editor.

**Se puede probar antes de contratar Railway:** empezar con SQLite y archivos locales, y después verificar PostgreSQL y el contenedor localmente. El recorrido detallado, los comandos y sus límites están en [pruebas locales](pruebas-locales.md). La decisión de alojamiento se toma con esa aceptación y las métricas del entorno objetivo.

## 1. Preparar el entorno local

Usar Node **24.22.1 o posterior**. Desde la raíz del proyecto:

```powershell
node --version
npm.cmd ci
if (!(Test-Path -LiteralPath '.env.local')) { Copy-Item .env.example .env.local }
```

La copia condicional conserva un archivo ya configurado. `.env.local` está excluido de Git. No se deben enviar credenciales por el repositorio ni escribirlas en documentación.

Generar una clave aleatoria y pegar el resultado en `PAYLOAD_SECRET` del archivo privado:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Para empezar sin instalar PostgreSQL, usar estos valores en `.env.local` y completar las tres credenciales indicadas:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CATALOG_SOURCE=cms
USE_SQLITE=true
DATABASE_URL=
SQLITE_URL=file:./megatravel.db
PAYLOAD_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
MEDIA_DIR=
R2_BUCKET=
```

`PAYLOAD_SECRET` recibe la clave generada; `ADMIN_EMAIL`, el correo de la primera cuenta; y `ADMIN_PASSWORD`, una contraseña propia de al menos 14 caracteres. Mantener el secreto estable en ese entorno. Dejar `R2_BUCKET` vacío utiliza `media/` para las imágenes locales. SQLite sirve para desarrollo; producción exige PostgreSQL con el código actual.

## 2. Crear la primera cuenta e importar

```powershell
npm.cmd run bootstrap
npm.cmd run import:cms -- --historical --skip-images
```

El bootstrap crea un administrador y rechaza ejecutarse si ya hay usuarios. El segundo comando valida `migration/departures.csv` sin importar registros y genera `migration/import-report-dry-run.json`. Revisar los errores antes de escribir. La opción histórica corresponde al traslado inicial de datos; no es necesaria para el trabajo diario.

Para importar y copiar los flyers desde sus enlaces:

```powershell
npm.cmd run import:cms -- --historical --commit
npm.cmd run dev
```

Para una primera prueba local sin descargar imágenes, añadir `--skip-images` al comando con `--commit`. Se conservarán los enlaces originales; esto no verifica su disponibilidad. Una descarga fallida también conserva el enlace y se informa en el reporte.

Después de crear el administrador, vaciar `ADMIN_PASSWORD` en `.env.local`. Conservar `ADMIN_EMAIL` si se seguirá usando el importador CLI. No repetir la copia de `.env.example` para hacer este cambio.

Abrir `/admin` e iniciar sesión. Para comprobar la conexión entre panel y web, crear una salida de prueba con fecha futura, completar los datos comerciales y publicarla; revisar `/` y `/api/public/catalog`. Al retirarla con motivo debe desaparecer. Una pestaña ya abierta vuelve a consultar cada 30 segundos.

Los registros publicados del Excel pueden haber vencido desde la extracción. Revisar el reporte: corregir el estado o contenido según corresponda al negocio, sin cambiar una fecha real para forzar la publicación. El total importado no es necesariamente el total visible.

## 3. Configurar el equipo y trabajar

Como administrador:

1. Abrir **Usuarios** y crear cuentas individuales con rol Editor para quienes gestionen programas. El rol Administrador también permite gestionar usuarios y configuración.
2. Revisar **Configuración del catálogo**, especialmente el contacto comercial.
3. Revisar Destinos, Orígenes, Navieras y Promociones. Configurar Banners con su alternativa estática y texto alternativo.
4. Revisar los diez borradores incompletos y los avisos de copia de flyers antes de publicarlos.

En **Salidas**, crear el primer registro desde el formulario o usar una salida importada como plantilla con «Duplicar un programa y crear salidas». Completar programa, MTPE, destino, zona, origen, duración, fecha, precio, moneda, condición, flyer y enlaces HTTPS de reserva/descriptivo. Guardar como borrador durante la preparación y cambiar a Publicado al terminar.

El retiro por defecto ocurre 30 días antes de viajar, a las 00:00 de Lima. Se puede cambiar la anticipación por salida. Retirar exige motivo; «Otro» exige observación. Reactivar exige revisar precio, enlaces y vigencia y marcar la confirmación. Los cambios quedan en el historial. Más detalle en [la guía del equipo comercial](editores.md).

Las cuentas de editores son usuarios de Payload. No necesitan acceso al panel de Railway para publicar o retirar programas.

### Subir imágenes como archivos: flujo principal

La preferencia del usuario es seleccionar el archivo desde el ordenador. El CMS actual ya permite subir JPEG, PNG, WebP y GIF a Imágenes y seleccionar ese archivo en el campo Flyer de la salida. El editor no necesita publicarlo primero en otro sitio ni pegar una URL. La aplicación obtiene automáticamente la dirección necesaria para mostrarlo en el navegador.

Los enlaces originales se conservan como herramienta de migración del Excel y procedencia de medios existentes. Para contenido nuevo, utilizar la carga normal de archivos. Guardar un archivo en R2 también es una carga normal: R2 o el volumen son el destino del archivo, independientemente de cómo lo seleccione el editor.

La conversión automática a WebP/AVIF y la generación de versiones con distintos tamaños **siguen pendientes de implementación**. La integración de Sharp existente no acredita esa conversión: la colección actual no define formatos ni tamaños de salida. Mientras tanto, se pueden subir archivos WebP previamente optimizados.

El flujo de optimización previsto debe conservar el original, generar una versión para tarjeta y otra legible para ampliar, mantener el flyer completo y verificar que precios y condiciones sigan claros. El objetivo de peso se debe definir con imágenes reales; no imponer una compresión que borre texto. Si se elige una publicación estática, optimizar durante carga/build y publicar los archivos resultantes, conservando la misma experiencia de selección del editor.

La carga y administración de imágenes continúa en Payload. El [presupuesto de Railway](costos-railway.md) explica el consumo de la aplicación, la base y los archivos.

## 4. Pasar a PostgreSQL y Railway

Para PostgreSQL local, instalar Docker si se elige Compose y ejecutar `docker compose up -d`. Cambiar `USE_SQLITE=false`, `CATALOG_SOURCE=cms` y `DATABASE_URL` por la conexión de desarrollo de `.env.example`. SQLite y PostgreSQL son bases distintas: cambiar la URL no traslada cuentas ni contenido.

En Railway, la aplicación necesita:

| Valor | Configuración |
| --- | --- |
| `DATABASE_URL` | Referencia a la URL privada del servicio PostgreSQL del proyecto; no escribirla en Git |
| `PAYLOAD_SECRET` | Secreto propio de producción de al menos 32 caracteres |
| `NEXT_PUBLIC_SITE_URL` | URL HTTPS del servicio y después del dominio definitivo; conservar coherencia entre build y ejecución |
| `CATALOG_SOURCE` | `cms`; `workbook` mantiene visible la instantánea aunque se edite el panel |
| `USE_SQLITE` | `false` |
| Archivos | Elegir una de las dos opciones siguientes |
| `ADMIN_EMAIL` y `ADMIN_PASSWORD` | Solo para el bootstrap privado; retirar la contraseña después |

**Con R2:** configurar `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_PUBLIC_URL`. El endpoint S3 es para cargas; la URL pública es para que el visitante vea imágenes. Usar un dominio público de medios y permisos limitados al bucket. Las cargas se guardan en R2.

**Con archivos también en Railway:** dejar `R2_BUCKET` vacío, establecer `MEDIA_DIR=/app/media` y montar un volumen persistente de la aplicación exactamente en `/app/media`. PostgreSQL conserva su propio volumen. El Dockerfile ya fija esta ruta. Hay que comprobar escritura con el usuario `node`, una carga pública y su persistencia tras un despliegue. Railway advierte de posibles permisos con imágenes que usan usuarios no root; resolverlos forma parte de validar esta opción. [Volúmenes Railway](https://docs.railway.com/volumes/reference).

Los buckets S3 de Railway son privados y no ofrecen una URL pública equivalente a `R2_PUBLIC_URL`. Usarlos requiere adaptar la entrega de archivos con URLs firmadas o un proxy; no basta con sustituir credenciales R2. La alternativa de volumen no utiliza un bucket. [Archivos en Railway](https://docs.railway.com/guides/storage-buckets-guide).

Antes del arranque CMS de producción, generar, revisar, versionar y aplicar la migración PostgreSQL inicial. La sincronización automática del esquema está desactivada en producción. Ejecutar bootstrap/importación dentro de un entorno privado con acceso a esa base; los comandos aceptan variables del servicio sin `.env.local`. El Dockerfile no incluye `migration/`: para la carga inicial se puede subir el CSV desde el panel o ejecutar el CLI desde un checkout autorizado con acceso a la base y al almacenamiento elegido.

Si se elige volumen para imágenes, importar desde el panel o ejecutar el CLI dentro del servicio con ese volumen y el CSV disponible. Ejecutar la importación en el ordenador con `MEDIA_DIR` local no copia esos binarios al volumen de Railway. Con R2, el CLI puede cargar al mismo bucket desde un checkout autorizado.

Programar retiros con `npm run retire` a `0 5 * * *` UTC, usando un servicio cron con configuración propia y sin healthcheck HTTP. Alternativamente, programar `POST /api/cron/retire` con `CRON_SECRET`. El catálogo también filtra la vigencia si la tarea se retrasa. Completar copias y restauración antes del corte; ver [operación](operacion.md).

## Correo y problemas frecuentes

Todavía no hay adaptador de correo transaccional. El login funciona con la cuenta creada, pero el mensaje de recuperación de contraseña se escribe en consola en el estado actual. Falta implementar el adaptador, elegir proveedor/remitente y probar recepción; rellenar variables SMTP sin ese código no lo habilita. [Configuración de correo Payload](https://payloadcms.com/docs/email/overview).

| Síntoma | Revisar |
| --- | --- |
| Los cambios del panel no aparecen en la web | `CATALOG_SOURCE=cms`, estado Publicado y fecha de retiro vigente |
| El catálogo abre, pero `/admin` falla | Base, secreto y migraciones; el modo `workbook` puede funcionar sin CMS |
| «Ya existen usuarios» al hacer bootstrap | Usar la cuenta creada; gestionar nuevas cuentas desde Usuarios |
| Falta la contraseña de una cuenta | Otro administrador puede cambiarla desde Usuarios; no depender aún del correo |
| Desaparecen imágenes después de desplegar | R2 o volumen persistente, ruta `MEDIA_DIR` y permisos |
| Se bloquea copiar una imagen | Host exacto en `IMPORT_MEDIA_ALLOWED_HOSTS`, HTTPS, firma válida, tamaño y ausencia de redirecciones |
| El CSV devuelve errores | Revisar el reporte por fila; puede haber publicaciones vencidas o datos incompletos |

Estado de validación y siguientes tareas: [continuidad](continuidad.md). Estimación del alojamiento: [costos Railway](costos-railway.md).
