Esta carpeta corresponde al esquema de PostgreSQL. No contiene los datos del Excel: esos están en `migration/`, en la raíz del proyecto. Para el contexto completo, consulta [arquitectura](../../docs/arquitectura.md), [configuración](../../docs/configuracion.md) y [operación](../../docs/operacion.md).

El 28 de octubre de 2026 se generaron dos migraciones PostgreSQL sin conexión a una base: `20261028_220221_initial` reconstruye el esquema anterior desde Git y `20261028_220255_programs_and_banner_placements` añade Programas/versiones, relaciones e índices y la ubicación de banners. La reversión elimina primero las claves foráneas para evitar referencias eliminadas por CASCADE. Su ejecución debe comprobarse en PostgreSQL de staging antes de producción.

En una base nueva se ejecutan ambas en orden. Una base PostgreSQL creada previamente por push requiere conciliar primero el esquema y el historial de migraciones: no ejecutar el CREATE inicial sobre tablas existentes. Tras el esquema, `npm run migrate:programs` prepara el reporte de datos y `-- --commit` aplica la unificación. El respaldo, reporte y reversión están documentados en [Datos y API](../../docs/datos-y-api.md#migración-de-salidas-existentes-a-programas). La migración de datos no modifica las versiones ni el historial anteriores.

Para aplicar las migraciones preparadas en una PostgreSQL vacía de staging:

```sh
npm run migrate
```

La aplicación usa `push: false` en producción. Para cambios futuros, `npm run migrate:create -- nombre` compara los snapshots existentes. Las pruebas locales de Payload con SQLite no validan PostgreSQL; el despliegue sigue condicionado a comprobar estas migraciones en staging. Para la SQLite local antigua, el CLI incluye preparación del esquema con copia completa y comparación de todas las tablas; esta transición no debe hacerse mediante push automático. Consultar [el estado actual](../../docs/continuidad.md).

`20261028_230629_popup_announcements` incorpora la ubicación popup, título, mensaje, tipo, botón, espera y frecuencia. Permite omitir imágenes solo en noticias de texto; las validaciones del CMS siguen exigiendo ambas imágenes para banners. La reversión se detiene si quedan popups o registros sin imágenes para evitar pérdida de anuncios. Aplicar y verificar en PostgreSQL de staging antes del despliegue.

`20261029_175432_departure_seat_references` añade cantidad referencial, etiqueta manual, fecha de revisión y confirmación transitoria a Salidas y sus versiones. Agrega la vigencia global de 72 horas a Configuración y los índices de revisión. Los registros existentes empiezan sin referencia. La reversión se detiene si hay cupos guardados en salidas/versiones o una vigencia personalizada; requiere respaldo y conciliación explícita antes de eliminar columnas.

La cadena completa y la nueva migración se validaron el 29 de octubre de 2026 con PostgreSQL embebido PGlite: preservación de datos, valores iniciales, protección de reversión y reaplicación. Esto no reemplaza la comprobación del adaptador Payload contra el PostgreSQL de staging antes del despliegue. SQLite tiene preparación aditiva y respaldo mediante `scripts/prepare-sqlite-schema.ts`; se verificó sobre una copia de la base local, conservando los datos originales.
