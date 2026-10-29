# Validación local antes de Railway

Guía del 24 de octubre de 2026 para la implementación Next/Payload, confirmada como arquitectura del proyecto. Se deben validar permisos, historial privado, operación comercial y facilidad de uso con el equipo antes de desplegar. La configuración del CMS está en [Payload](cms.md#cms-del-proyecto-payload).

La aplicación puede probarse localmente sin contratar Railway ni conectar una base de producción. Hay dos niveles: SQLite para empezar con el panel y PostgreSQL para comprobar la base y migraciones previstas para producción. Superar el primero no sustituye al segundo.

## Nivel 1: web y CMS con SQLite y archivos locales

Node ya está actualizado a 24.22.1 en el equipo revisado. Desde la raíz del proyecto:

```powershell
node --version
# Solo si faltan las dependencias o se está preparando otro equipo.
npm.cmd ci
if (!(Test-Path -LiteralPath '.env.local')) { Copy-Item .env.example .env.local }
```

En `.env.local`, configurar:

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
CATALOG_SOURCE=cms
USE_SQLITE=true
DATABASE_URL=
SQLITE_URL=file:./megatravel.db
MEDIA_DIR=
R2_BUCKET=
PAYLOAD_SECRET=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

Los tres últimos valores deben completarse en el archivo privado: clave aleatoria de al menos 32 caracteres, correo de la primera cuenta y contraseña de al menos 14 caracteres. Generar la clave con:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Dejar R2 desactivado utiliza la carpeta local `media/`. El archivo SQLite, las imágenes y las credenciales están excluidos de Git. Para probar registros manuales no hacen falta cuentas de proveedores ni descargar imágenes remotas.

```powershell
npm.cmd run bootstrap
npm.cmd run dev
```

Abrir `http://localhost:3000/admin` para el panel y `http://localhost:3000` para el catálogo. El bootstrap crea la cuenta únicamente si la base no tiene usuarios. Después, vaciar `ADMIN_PASSWORD` del archivo privado. No se creó una cuenta nueva ni un `.env.local` operativo durante la elaboración de esta guía.

Para cargar el Excel preparado, seguir la validación/importación de [la guía CMS](cms.md#2-crear-la-primera-cuenta-e-importar). Es opcional para empezar a probar: también se pueden crear salidas ficticias con datos identificados como prueba y fechas futuras. No publicar un registro vencido modificando una fecha real para eludir la validación.

## Recorrido de aceptación con administrador y editor

Crear desde Usuarios una segunda cuenta con rol Editor y probarla en otra sesión de navegador. El objetivo es comprobar operaciones completas y lo que puede ver/hacer cada persona.

| Función | Prueba local y resultado esperado |
| --- | --- |
| Crear un programa/salida | Guardar un borrador con precio, fecha, origen y destino; no aparece en el catálogo público |
| Subir un flyer como archivo | Seleccionar JPEG/PNG/WebP desde el ordenador, guardar y abrirlo completo en panel y catálogo |
| Publicar | Completar flyer y enlaces HTTPS; aparece una salida vigente |
| Validar datos | Precio inválido, falta de flyer o salida vencida impiden publicar |
| Actualizar | Cambiar precio, fecha o imagen; comprobar el dato guardado y su aparición pública |
| Varias fechas | Duplicar una plantilla con dos fechas; se crean borradores separados sin duplicar fechas existentes |
| Retirar | Elegir motivo y guardar; desaparece del catálogo y conserva responsable e historial |
| Reactivar | Revisar datos vigentes y confirmar revisión; vuelve a publicarse con trazabilidad |
| Permisos | El editor gestiona contenido; usuarios y configuración administrativa quedan restringidos |
| Historial privado | Cambios consultables por usuarios autorizados; los campos internos no aparecen en la respuesta pública |
| Filtros y búsqueda | Programa, MTPE, destino, fechas y promociones combinables; URL compartida reproduce la selección |
| Banners/promociones | Probar periodos de vigencia, orden y alternativa estática del banner |
| CSV | Validar primero, importar, repetir conservando claves y exportar; no se crean duplicados |
| Persistencia | Reiniciar el servidor de desarrollo y comprobar usuarios, contenido y archivos |
| Interfaz | Probar escritorio/móvil, teclado, mensajes de error, ampliación y lectura del flyer |

Una pestaña pública abierta consulta cambios cada 30 segundos. Ese plazo forma parte del comportamiento actual; comprobar también una recarga. Si se modifica la entrega pública mediante caché o exportación estática, habrá que repetir estas pruebas con su nuevo mecanismo de actualización.

Para el retiro programado, ejecutar manualmente la tarea con el entorno local:

```powershell
node --env-file=.env.local --import=tsx scripts/retire.ts
```

La ejecución manual comprueba el comando y la lógica sin necesitar un programador Railway. Un resultado con cero retiros no verifica el caso de una salida vencida. Las pruebas de fecha/corte tienen cobertura de dominio; la aceptación completa de la tarea debe incluir registros de prueba y fechas controladas, historial y ausencia pública. No cambiar el reloj de Windows ni usar datos de producción para forzar esa comprobación.

## Comprobaciones automatizadas y estado

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run test:integration
npm.cmd run build
```

El 24 de octubre se verificaron 31 pruebas, tipos y 14 comprobaciones de Payload con SQLite/medios aislados bajo `.qa/`, además del build con Node 24.22.1. El script de integración crea sus propias cuentas y base de prueba; no prepara el panel de uso diario. Los resultados completos y pendientes están en [continuidad](continuidad.md).

Para cupos referenciales, el 29 de octubre se verificaron 50 pruebas de dominio y 52 comprobaciones de integración SQLite. Incluyen independencia por fecha, cantidad opcional/cero, validación, auditoría y confirmación de revisión, conservación al importar y editar programas, duplicación y filtro de cupos vencidos. En gstack se comprobaron cards en escritorio/móvil, los enlaces a Meganet y al asesor, el vencimiento en una pestaña abierta, la confirmación desde el panel y la creación de un borrador con cupos por fila, sin errores de consola. La migración se comprobó con PostgreSQL embebido PGlite; falta validarla con el adaptador en el PostgreSQL de staging. La actualización de SQLite se ensayó sobre una copia de la base local, conservando 409 salidas y las tablas originales.

La revisión visual posterior del 29 de octubre incorporó las referencias de `Images/`: franja de últimos cupos con cantidad bajo el flyer y boleto dorado para Año Nuevo. Se verificaron cards y hero a 375, 768 y 1440 px: sin desbordes, sin franja adicional bajo el banner, flechas laterales y pausa en esquina con áreas de 44 px. También se comprobó el banner horizontal sin versión móvil a 320 px: los controles permanecen dentro de la imagen y no se solapan. En gstack se comprobaron navegación, avance automático, pausa/reanudación, eventos táctiles del control y preferencia de movimiento reducido. Se corrigió la pausa involuntaria al cambiar el icono de reproducción bajo el puntero. Las referencias gráficas siguen excluidas de Git.

El recorrido manual por navegador, el ciclo completo de la tarea de retiros y la validación PostgreSQL siguen pendientes. La conversión automática de imágenes y el adaptador de correo aún requieren implementación; iniciar localmente no las habilita. Para correo se podrá utilizar un servidor SMTP de pruebas local al incorporar el adaptador.

## Nivel 2: PostgreSQL y despliegue local comparable

Instalar/disponer de Docker para usar el Compose incluido. En la terminal revisada no hay comandos Docker ni herramientas PostgreSQL disponibles en PATH.

```powershell
docker compose up -d
```

En el entorno local de esta etapa, cambiar `USE_SQLITE=false` y usar la conexión PostgreSQL de desarrollo de `.env.example`. Conservar `CATALOG_SOURCE=cms`. SQLite y PostgreSQL tienen datos y cuentas separados; cambiar el adaptador no migra el contenido.

Generar y revisar la migración inicial con `npm.cmd run migrate:create -- inicial`, versionar sus archivos y probar `npm.cmd run migrate` contra otra base vacía de pruebas. Validar acceso, carga de medios e importación con el adaptador PostgreSQL. El esquema de desarrollo sincronizado automáticamente no prueba por sí solo que una base vacía de producción pueda arrancar mediante migraciones.

Después, construir y arrancar el Dockerfile en el equipo con PostgreSQL de pruebas, variables privadas y persistencia local. El contenedor debe conectarse a PostgreSQL con una dirección accesible desde su red: `localhost` dentro del contenedor no es la base del ordenador. Comprobar `/api/health`, recursos estáticos y una imagen después de recrear el contenedor. La configuración Compose actual inicia solamente PostgreSQL; no inicia toda la aplicación ni configura esas conexiones.

Probar backup y restauración en otra base con nombre terminado en `_restore`, siguiendo [operación](operacion.md). Esta etapa puede hacerse sin Railway; requiere las herramientas PostgreSQL o ejecutarlas dentro de un contenedor apropiado.

## Qué necesita una última prueba en el proveedor

La lógica del catálogo, CMS, base, archivos y comando de retiro puede comprobarse antes del despliegue. DNS/HTTPS, volúmenes de Railway, cron del proveedor, entrega real de correo y almacenamiento R2, si se elige, necesitan su propia validación en el entorno correspondiente. También se debe medir allí CPU/RAM y costo, porque el consumo de Windows en desarrollo no es una cotización del contenedor de producción.

Payload permite mantener web, CMS, datos e imágenes en el ordenador durante las pruebas locales.
