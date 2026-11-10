# Documentación del desarrollo

Esta documentación describe el código y su operación. Distingue la configuración comprobada de los pasos pendientes.

## Por dónde empezar

| Necesidad | Documento |
| --- | --- |
| Conocer el estado verificado y el orden para continuar | [Estado y próximos pasos](continuidad.md) |
| Activar el CMS, crear la primera cuenta y empezar a editar | [Configuración y uso del CMS](cms.md) |
| Probar web, CMS y operación antes de Railway | [Validación local](pruebas-locales.md) |
| Estimar el costo frente a USD 20/mes | [Presupuesto Railway](costos-railway.md) |
| Entender carpetas, archivos y recorrido de una petición | [Arquitectura y estructura](arquitectura.md) |
| Saber qué archivo cambiar para modificar una función | [Guía de mantenimiento](mantenimiento.md) |
| Entender campos, estados, importaciones y endpoints | [Datos, reglas y API](datos-y-api.md) |
| Preparar el ordenador, variables y comandos | [Configuración y comandos](configuracion.md) |
| Configurar Railway, almacenamiento y dominio | [Producción y proveedores](produccion.md) |
| Conectar GitHub, hacer push y trabajar en varios equipos | [Git y GitHub](github.md) |
| Ejecutar el corte, retiros y copias de seguridad | [Operación y lanzamiento](operacion.md) |
| Rotar credenciales y elegir almacenamiento o copias | [Guía práctica de Railway](guia-railway-operacion.md) |
| Activar R2 y optimizar imágenes | [R2 e imágenes](r2-imagenes.md) |
| Usar el CMS como editor comercial | [Guía de editores](editores.md) |
| Configurar y verificar la automatización de cupos por correo | [Gmail y Railway](gmail-cupos-piloto.md) |
| Consultar opciones comerciales con Convertalk | [Viabilidad de Convertalk](convertalk-viabilidad.md) |

Lectura sugerida: arquitectura → mantenimiento → configuración. Para una tarea concreta, empieza por la tabla «Dónde hacer cada cambio» de la guía de mantenimiento.

El CMS elegido es **Payload**. Para la configuración pendiente, empieza por [configuración y uso del CMS](cms.md), continúa con [validación local](pruebas-locales.md) y después con [operación y lanzamiento](operacion.md).

## Cuatro distinciones esenciales

1. **Código y contenido:** la presentación y las reglas se cambian en el repositorio. Precios, fechas, promociones y publicaciones se gestionan en el CMS cuando esté activo.
2. **Dos fuentes de catálogo:** `workbook` muestra una instantánea del Excel; `cms` consulta la base. Editar el CMS no cambia la instantánea.
3. **Dos carpetas de migración:** `migration/` contiene datos y reportes del Excel. `src/migrations/` contiene las futuras migraciones del esquema PostgreSQL.
4. **Git y persistencia:** Git guarda código y archivos versionados. Usuarios, contenido de PostgreSQL, claves, medios de R2 y copias de seguridad tienen su propio almacenamiento.

## Alcance verificado

El registro de la implementación anterior está en [migration/verification.json](../migration/verification.json). Sus resultados corresponden a esa ejecución. El [estado del 24 de octubre](continuidad.md) registra las comprobaciones posteriores, repetidas con Node 24.22.1: 31 pruebas, 14 verificaciones del CMS con SQLite/medios aislados, tipos, sintaxis y build local completado sin advertencias de compilación.

La revisión de Railway del 4 de noviembre confirmó la aplicación, PostgreSQL, el chequeo de salud y una ejecución correcta del cron. Permanecen pendientes la validación de archivos persistentes, copias y restauración, correo y ajustes del despliegue; ver [estado actual](continuidad.md). Los resultados históricos no sustituyen una prueba actual.
