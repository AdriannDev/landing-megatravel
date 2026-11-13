# Verificación de correos reales y retirada de fijaciones

Validación local del 13 de noviembre de 2026 con Node 24.22.1. Las pruebas utilizaron bases aisladas, ejemplos anonimizados y transporte IMAP/Graph simulado. El servidor y la base local que ya estaban en uso se conservaron; la revisión visual usó una instancia independiente en el puerto 3100.

La causa del fallo estaba en las etiquetas no admitidas, el análisis global de códigos MTP que confundía el ID del viaje con una reserva y la combinación de partes basada en el texto de los errores. La corrección separa la identidad comercial del viaje, añade los totales/estados acordados y utiliza incidencias estructuradas para combinar campos. La reproducción inicial falló en las seis pruebas nuevas; las pruebas finales cubren esos casos y el contexto repartido entre partes.

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 113 pruebas correctas |
| `npm run test:integration` | 78 comprobaciones del CMS, incluido blog con seis miniaturas WebP y conservación de contacto/vigencia |
| `npm run test:panel-pilot` | 23 comprobaciones de permisos, Graph simulado y transacciones |
| `npm run test:gmail-pilot` | 25 comprobaciones, incluidas las dos plantillas completas por MIME y el lector IMAP simulado |
| `npm run test:departure-seats` | 18 grupos de comprobaciones de cupos independientes, conciliación, traslados, concurrencia y reversión |
| `npm run test:featured-migration` | Cadena PostgreSQL completa con PGlite; conservación de todos los registros salvo las dos columnas retiradas, blog e imágenes intactos, snapshot, reversión y reaplicación |
| `npm run test:seats-migration` | Migración anterior comprobada por nombre, conservando historial, saldos, preferencias y cursores |
| `npm run test:local-schema` | Base nueva, actualización desde columnas antiguas, blog e historial conservados, arranque repetible y rechazo de temporales con datos |
| `npm run generate:types`, `npm run generate:importmap` | Tipos e importaciones regenerados sin los selectores retirados |
| TypeScript, sintaxis y dominio | Correctos en la ejecución final |
| Compilación de producción | Correcta en la ejecución final con el código completo; compilación y TypeScript sin errores |

Los ejemplos reutilizables están en `tests/fixtures/real-booking-emails.mjs`; las pruebas de extracción y MIME, en `tests/real-booking-emails.test.mjs`. Correo1 reconoce dos cupos e informa únicamente **Falta el estado**; el lector registra la observación sin descontar y un mensaje nuevo con `Estado: Reserva` descuenta dos. Correo2 reconoce un cupo, **A petición**, `2026-11-21` y `MTP-CLOSEDTOUR-503866`. `MTP-6478` queda en `tripId`, fuera de la identidad y la huella comercial.

Se comprobaron reenvíos en línea y adjuntos, tablas sin dos puntos, campos repartidos entre texto y HTML, errores estructurados independientes de su redacción, referencias contradictorias, cantidades inválidas y ausencia de totales en listas de nombres/documentos/edades. Las pruebas del lector verifican repetición sin doble descuento, cambios de cantidad, cancelaciones repetidas, traslado entre fechas y bloqueo por origen ambiguo o salida sin conciliación. Los correos observados conservan su historial y no se reprocesan automáticamente.

SQLite guarda un respaldo completo antes de la transacción y verifica las demás columnas, filas, identificadores, índices, relaciones y triggers. La excepción de preservación solo admite las dos columnas de fijación y sus índices/relaciones en `settings`. Una dependencia adicional o un índice con nombre esperado y contenido distinto revierte la actualización. Las migraciones históricas no se editaron.

La revisión visual se realizó con **gstack browse**, usando su Chromium en Windows, a **1440 × 1000** y **375 × 812**:

- El panel conserva contacto, vigencia de cupos, actualización del blog y seis artículos con miniaturas; no muestra las fijaciones ni sus campos. Sin desbordamiento horizontal.
- En tarjetas, las primeras tres miden **316 px** en escritorio y **339 px** en móvil, sin ampliaciones especiales. En lista miden **982 px** y **339 px**, respectivamente.
- Los banners se mantienen encima de los controles, el rompetráfico sigue a los primeros seis productos y la API pública no incluye `featuredPackageIds`.
- Se conservan **Destacados**, promociones, **Nuevo**, **Últimos cupos**, doce resultados por página y seis artículos del blog. Sin errores de consola tras completar la compilación del servidor.

Las capturas con contenido de prueba están en `.qa/approved-plan-ui/`. Se cerraron la pestaña, el Chromium y el servidor de prueba al terminar. La compilación inicial del panel produjo avisos Sass de dependencias. Una ejecución unitaria simultánea con el build de once trabajadores agotó el límite de 20 segundos de la prueba de cierre de PostgreSQL; la ejecución final, sin build paralelo, completó las 113 pruebas en 7,3 segundos. No se cambiaron límites ni se omitieron pruebas.

## Puesta en marcha pendiente

Respaldar PostgreSQL y comprobar la migración con el adaptador real en staging antes de aplicar `20261113_220000_remove_featured_departures` y desplegar. La reversión repone las columnas vacías; sus valores previos requieren el respaldo. PGlite no sustituye esa comprobación. Mantener el buzón, el cron y los cursores y validar después con **un correo nuevo recibido por el lector real**. Esta ejecución no conectó el buzón, no envió mensajes ni modificó la base de producción.

Estado: **DONE_WITH_CONCERNS**. Implementación y validación local completadas; la puesta en marcha y el lector real requieren la comprobación operativa descrita arriba.
