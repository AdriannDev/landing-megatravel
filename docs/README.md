# Documentación del desarrollo

Esta documentación describe el código existente y dónde modificarlo. Los pasos de lanzamiento son instrucciones para una etapa posterior; documentarlos no significa que se hayan ejecutado.

## Por dónde empezar

| Necesidad | Documento |
| --- | --- |
| Entender carpetas, archivos y recorrido de una petición | [Arquitectura y estructura](arquitectura.md) |
| Saber qué archivo cambiar para modificar una función | [Guía de mantenimiento](mantenimiento.md) |
| Entender campos, estados, importaciones y endpoints | [Datos, reglas y API](datos-y-api.md) |
| Preparar el ordenador, variables y comandos | [Configuración y comandos](configuracion.md) |
| Resolver hosting, Railway, Hostinger, dominio y servicios | [Producción y proveedores](produccion.md) |
| Conectar GitHub, hacer push y trabajar en varios equipos | [Git y GitHub](github.md) |
| Ejecutar el corte, retiros y copias de seguridad | [Operación y lanzamiento](operacion.md) |
| Usar el CMS como editor comercial | [Guía de editores](editores.md) |

Lectura sugerida: arquitectura → mantenimiento → configuración. Para una tarea concreta, empieza por la tabla «Dónde hacer cada cambio» de la guía de mantenimiento.

## Cuatro distinciones esenciales

1. **Código y contenido:** la presentación y las reglas se cambian en el repositorio. Precios, fechas, promociones y publicaciones se gestionan en el CMS cuando esté activo.
2. **Dos fuentes de catálogo:** `workbook` muestra una instantánea del Excel; `cms` consulta la base. Editar el CMS no cambia la instantánea.
3. **Dos carpetas de migración:** `migration/` contiene datos y reportes del Excel. `src/migrations/` contiene las futuras migraciones del esquema PostgreSQL.
4. **Git y persistencia:** Git guarda código y archivos versionados. Usuarios, contenido de PostgreSQL, claves, medios de R2 y copias de seguridad tienen su propio almacenamiento.

## Alcance verificado

El registro de la implementación anterior está en [migration/verification.json](../migration/verification.json). Sus resultados corresponden a esa ejecución. La documentación y preparación de Git no vuelven a ejecutar los pendientes de integración, build, inspección visual, base de datos, restauración o despliegue.

En esta revisión existen `node_modules/`, `package-lock.json`, `.next/` y tipos generados. La presencia de esos archivos no acredita por sí sola que el CMS o el build estén validados. El Node instalado observado es 24.19.0; el proyecto declara 24.22.1 o posterior.
