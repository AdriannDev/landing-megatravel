# Railway: prueba con catálogo vacío

Esta guía prepara una prueba, no acredita que el despliegue o la migración hayan sido verificados. Una PostgreSQL nueva no contiene las cuentas ni los programas de la base local. El plan de automatización de correos y cupos continúa en pausa.

## Antes de empezar

- Necesitas una cuenta de Railway, un repositorio privado con el código actualizado y acceso para configurarlo. Revisa en Railway el plan y los límites vigentes antes de crear servicios. Según sus [planes](https://docs.railway.com/pricing/plans), Free comienza con 30 días y USD 5 de prueba; después dispone de USD 1 mensual. Los recursos no son ilimitados y el agotamiento del crédito puede detener la prueba.
- Tras la prueba, Free admite un volumen por proyecto. PostgreSQL necesita almacenamiento persistente; por tanto, no cuentes con un segundo volumen para imágenes en ese mismo proyecto. Los cron están disponibles en la prueba y no después en Free. Confirma las condiciones en la cuenta, pues pueden cambiar.
- Para imágenes persistentes sin segundo volumen, la integración existente admite Cloudflare R2. [R2 Standard](https://developers.cloudflare.com/r2/pricing/) ofrece una franquicia gratuita sujeta a límites; revisa alta, medio de pago y uso. Si no vas a cargar imágenes durante la prueba, puedes dejar R2 sin configurar y no depender de archivos subidos al disco temporal.
- El repositorio debe contener el estado actualizado, incluidas las migraciones de `src/migrations`. No subas `.env.local`, la base SQLite ni el Excel. No ejecutes el importador del Excel ni CSV si quieres comenzar sin programas.

## Crear los servicios y variables

1. Crea un proyecto en Railway y añade PostgreSQL. Su volumen conserva la base; comprueba que quede asociado al servicio.
2. Añade un servicio desde el repositorio. El archivo `railway.toml` selecciona el Dockerfile y `/api/health`. Genera un dominio HTTPS del servicio desde su configuración de red.
3. En las variables del servicio web, configura los siguientes valores antes de compilar y ejecutar. Usa la referencia privada de Railway a `DATABASE_URL` del servicio PostgreSQL, no la pegues en el repositorio.

| Variable | Valor para la prueba |
| --- | --- |
| `DATABASE_URL` | Referencia a la URL privada del PostgreSQL del mismo proyecto |
| `PAYLOAD_SECRET` | Secreto nuevo y estable, aleatorio, de al menos 32 caracteres |
| `NEXT_PUBLIC_SITE_URL` | URL HTTPS completa del servicio, sin barra final; debe coincidir durante build y ejecución |
| `CATALOG_SOURCE` | `cms` |
| `USE_SQLITE` | `false` |
| `R2_BUCKET` | Vacío si todavía no se usarán imágenes persistentes |

Puedes generar el secreto en tu equipo con `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Guárdalo en Railway, sin compartirlo. Si cambia, puede afectar las sesiones y datos protegidos existentes. `NEXT_PUBLIC_GA4_ID` es opcional; `ADMIN_EMAIL` y `ADMIN_PASSWORD` solo se necesitan durante la creación privada de la primera cuenta.

4. Si se van a subir flyers persistentes, crea y configura un bucket R2 con acceso público controlado para las imágenes. Añade `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_PUBLIC_URL`. La URL pública es distinta del endpoint S3 de carga. Limita la clave al bucket. Comprueba los requisitos actuales de Cloudflare y que una imagen cargada abra en el navegador. Un bucket privado de Railway no sustituye directamente la URL pública requerida por esta integración.

Sin R2, los archivos guardados en el contenedor son temporales y pueden desaparecer al redesplegar. La alternativa de volumen para la app requiere un volumen separado montado en `/app/media`, con `MEDIA_DIR=/app/media`, y comprobar permisos de escritura del usuario `node`; verifica que el plan lo permita además del volumen de PostgreSQL.

## Inicializar esquema y administrador

La aplicación en producción no crea automáticamente las tablas. Hay siete migraciones registradas en `src/migrations/index.ts`; están preparadas, pero aún falta verificarlas con el adaptador Payload contra PostgreSQL real. Una base nueva debe recibirlas en orden mediante el comando existente, sin crear una migración inicial adicional:

```sh
npm run migrate
```

Ejecuta el comando una sola vez desde un entorno privado con el mismo código, `DATABASE_URL` y `PAYLOAD_SECRET` de la prueba y acceso de red a PostgreSQL. La URL privada de Railway normalmente solo es accesible desde su red; inyectar variables en un ordenador no garantiza conectividad. Se puede usar una consola del servicio desplegado o una tarea temporal dentro del proyecto. No expongas la base públicamente solo para evitar este paso. Verifica la salida y que todas las migraciones terminen sin errores antes de seguir. No apliques el esquema inicial indiscriminadamente sobre una base existente.

En ese entorno privado, configura temporalmente `ADMIN_EMAIL` y `ADMIN_PASSWORD` (mínimo 14 caracteres) y ejecuta:

```sh
npm run bootstrap
```

El comando solo crea la primera cuenta si no existen usuarios. Retira `ADMIN_PASSWORD` del entorno después. El formulario público no sustituye este paso. La recuperación de contraseña por correo aún no está implementada; conserva el acceso de forma segura.

## Comprobar la prueba

1. Abre `https://TU-DOMINIO/api/health`, el catálogo y `/admin`; inicia sesión con la nueva cuenta. Revisa los logs si falla una comprobación.
2. Confirma que el listado de Programas y Salidas está vacío y que el catálogo no muestra programas. No importes `migration/departures.csv` ni ejecutes `npm run import:workbook` para esta prueba.
3. Crea una salida de prueba con datos ficticios, publícala y comprueba que aparece. Retírala y verifica que desaparece. Si usas R2, sube una imagen, comprueba que se vea y que persista tras redesplegar.
4. Revisa consumo y alertas del proyecto. La funcionalidad de retiros programados precisa una tarea adicional: el catálogo filtra la vigencia aunque no se ejecute el cron, pero sin tarea no se registra automáticamente el retiro. Durante una prueba corta puede omitirse; para funcionamiento continuo se necesita un programador compatible o un plan que admita cron, con los controles descritos en [operación](operacion.md#retiro-programado).

Antes de usar datos reales o anunciar el sitio, valida migraciones, permisos, copias y restauración de la base y archivos. Esta guía no realiza por sí misma esas verificaciones ni configura servicios externos.
