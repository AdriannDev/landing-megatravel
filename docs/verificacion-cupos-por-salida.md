# Verificación de cupos por salida

Fecha: 13 de noviembre de 2026. Estado: **DONE_WITH_CONCERNS**. Implementación y verificación local completas; el corte operativo requiere PostgreSQL de staging y una carga nueva revisada por el equipo.

## Pruebas ejecutadas

| Comando | Resultado |
| --- | --- |
| `npm test` | 105 pruebas correctas |
| `npm run test:integration` | 83 comprobaciones CMS correctas |
| `npm run test:departure-seats` | 18 grupos correctos |
| `npm run test:gmail-pilot` | 23 comprobaciones correctas |
| `npm run test:panel-pilot` | 23 comprobaciones correctas |
| `npm run test:local-schema` | Base nueva/antigua, preservación, repetición, integridad y protección de temporales correctas |
| `npm run test:seats-migration` | Cadena PostgreSQL completa en PGlite, preservación, preferencias, reversión protegida y reaplicación correctas |
| `npm run check:domain` | Correcto |
| `npm run typecheck` | Correcto, también después de retirar rutas temporales de QA |
| `npm run build` | Compilación de producción correcta con los cambios finales |
| `git diff --check` | Correcto |

Las pruebas CMS/Gmail usan bases SQLite aisladas, usuarios ficticios y transportes de correo simulados. No se conectaron a un buzón real ni a producción. La prueba completa SQLite se repitió aislada y pasó después de un timeout de cierre al ejecutarla junto a la compilación.

La cobertura nueva incluye independencia entre fechas/orígenes, valores iniciales, duplicación sin saldo consumido, conciliación, cantidad/etiqueta por separado, conservación de reservas en asignaciones, conflictos de vista previa/CSV, cero/vacío, traslados de fecha/origen, saldo insuficiente, cancelaciones contradictorias, reversión de ambas salidas y observación de historial ligado a registros eliminados/recreados. Las pruebas del lector también verifican deduplicación, orden persistente, privacidad y reversión conjunta del progreso IMAP.

## Navegador

Verificado con **gstack browse** en `http://localhost:3100`, con una sesión y base de prueba aisladas:

- Salidas muestra **Cupos disponibles** junto a fecha/origen y mantiene revisión separada.
- Asignación desde selección: vista previa 15 → 7 y aplicación reflejada en la tabla.
- Asignación desde programa: vista previa de tres fechas con saldos 7, 15 y 0, seguida de aplicación a 11; el valor inicial del programa siguió en 15.
- Nueva fecha creó un borrador con cero explícito; Nueva salida presenta cupos, etiqueta y origen por fila.
- El catálogo mostró 11 cupos de la salida y la vista previa del formulario mostró 6 al editarla, antes de guardar.
- Correos observados muestra columnas independientes para programa MTPE, reserva MTP, fecha y origen.
- Consola final: sin errores. La primera compilación de desarrollo emitió advertencias Sass de dependencias y algunos tiempos de espera durante compilaciones iniciales; las páginas se verificaron después de completarlas.

Capturas locales, fuera de Git, en `.qa/independent-seats-preview.png`, `.qa/independent-program-preview.png`, `.qa/independent-catalog-card.png`, `.qa/independent-unsaved-preview.png` y `.qa/independent-observed.png`. Se cerraron la pestaña, el navegador y el servidor creados para QA.

## Puesta en marcha pendiente

Aplicar y comprobar `20261113_180329_independent_departure_seats` en PostgreSQL de staging, incluyendo adaptador Payload y bloqueos entre procesos. PGlite valida SQL y conservación de datos; no acredita esos dos aspectos del entorno real. Validar una carga nueva de disponibilidades actuales por fecha/origen antes del corte, siguiendo [la guía de operación](cupos-por-salida.md).

La implementación conserva configuración del buzón/cron y los identificadores, historial, deduplicación y cursores existentes. No migra saldos actuales ni programa su borrado. El comando histórico de consolidación por programa quedó retirado.
