Esta carpeta corresponde al esquema de PostgreSQL. No contiene los datos del Excel: esos están en `migration/`, en la raíz del proyecto. Para el contexto completo, consulta [arquitectura](../../docs/arquitectura.md), [configuración](../../docs/configuracion.md) y [operación](../../docs/operacion.md).

La cadena PostgreSQL incluye la migración inicial y cambios posteriores de programas, banners, cupos e imágenes. El 4 de noviembre de 2026 se comprobaron las primeras siete migraciones en la base de producción.

En una base nueva se ejecuta la cadena completa en orden. Una base PostgreSQL creada previamente por push requiere conciliar primero el esquema y el historial de migraciones: no ejecutar el CREATE inicial sobre tablas existentes. Las instrucciones de migración de datos y reversión están en [Datos y API](../../docs/datos-y-api.md#migración-de-salidas-existentes-a-programas).

`20261104_171419_r2_media_storage` agrega la columna opcional `_objectkey` a `media`. El nuevo código la necesita con o sin R2, por lo que debe aplicarse antes de iniciar la nueva versión. Su reversión se detiene si existen claves R2. La prueba con PGlite comprobó la conservación de datos y la protección de reversión; falta verificarla en PostgreSQL real. Sigue el orden de [R2 e imágenes](../../docs/r2-imagenes.md).

`20261109_014741_new_badge` agrega la etiqueta «Nuevo» (`new_badge`, `new_badge_label`, `new_badge_until`) en `programs`, `departures` y sus tablas de versiones, así como el contador editable (`countdown_enabled`, `countdown_ends_at`) en `banners`. Su reversión se detiene si hay etiquetas o contadores configurados.

Para aplicar las migraciones preparadas en una PostgreSQL vacía de staging:

```sh
npm run migrate
```

La aplicación usa `push: false` en producción. Para cambios futuros, `npm run migrate:create -- nombre` compara los snapshots existentes. Las pruebas locales de Payload con SQLite no validan PostgreSQL; el despliegue sigue condicionado a comprobar estas migraciones en staging. Para la SQLite local antigua, el CLI incluye preparación del esquema con copia completa y comparación de todas las tablas; esta transición no debe hacerse mediante push automático. Consultar [el estado actual](../../docs/continuidad.md).

`20261028_230629_popup_announcements` incorpora la ubicación popup, título, mensaje, tipo, botón, espera y frecuencia. Permite omitir imágenes solo en noticias de texto; las validaciones del CMS siguen exigiendo ambas imágenes para banners. La reversión se detiene si quedan popups o registros sin imágenes para evitar pérdida de anuncios. Aplicar y verificar en PostgreSQL de staging antes del despliegue.

`20261029_175432_departure_seat_references` añade cantidad referencial, etiqueta manual, fecha de revisión y confirmación transitoria a Salidas y sus versiones. Agrega la vigencia global de 72 horas a Configuración y los índices de revisión. Los registros existentes empiezan sin referencia. La reversión se detiene si hay cupos guardados en salidas/versiones o una vigencia personalizada; requiere respaldo y conciliación explícita antes de eliminar columnas.

La cadena completa y la nueva migración se validaron el 29 de octubre de 2026 con PostgreSQL embebido PGlite: preservación de datos, valores iniciales, protección de reversión y reaplicación. Esto no reemplaza la comprobación del adaptador Payload contra el PostgreSQL de staging antes del despliegue. SQLite tiene preparación aditiva y respaldo mediante `scripts/prepare-sqlite-schema.ts`; se verificó sobre una copia de la base local, conservando los datos originales.

`20261113_161026_correos_observados` agrega campos opcionales para asunto, remitente, recepción, cantidad, estado, salida, fecha y versión comercial, tipo de observación y huella del Message-ID. No cambia identificadores, reservas, cursores ni saldos existentes. Su reversión se detiene si hay nuevos metadatos para no perder deduplicación ni observaciones. Se verificaron la cadena completa, conservación de registros, reversión protegida y reaplicación con PGlite; `npm run test:local-schema` verifica la actualización SQLite con avisos heredados. Aplicar en PostgreSQL de staging antes de desplegar.

`20261113_180329_independent_departure_seats` añade conciliaciones por salida, identidad de salida en saldos simulados y origen/movimientos en correos. Cambia el índice MTPE de simulación a no único, añade unicidad por salida y actualiza preferencias conservando otras opciones. No traslada saldos ni vincula reservas históricas. Reversión protegida. Ejecutar `npm run test:seats-migration` (PGlite) y verificar adaptador/bloqueos en PostgreSQL de staging antes del corte; seguir [la carga nueva](../../docs/cupos-por-salida.md).

`20261113_220000_remove_featured_departures` retira únicamente las dos columnas de fijación, sus dos índices y sus relaciones en `settings`. Mantiene intactas las migraciones históricas y el blog, incluidas sus imágenes. Requiere respaldo verificado antes de aplicar en staging/producción. `npm run test:featured-migration` comprueba con PGlite todos los registros anteriores y el snapshot; la reversión repone columnas vacías y requiere el respaldo para recuperar selecciones antiguas. La actualización SQLite dirigida hace una copia completa y verifica datos, índices, relaciones y triggers dentro de una transacción.
