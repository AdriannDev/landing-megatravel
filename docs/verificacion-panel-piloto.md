# Verificación del panel y piloto

Verificación local realizada el 10 de noviembre de 2026, con Node 24.22.1, sin conectar buzones ni aplicar migraciones a producción.

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 80 pruebas correctas |
| `npm run test:integration` | 73 comprobaciones del CMS correctas, SQLite aislado |
| `npm run test:panel-pilot` | 23 comprobaciones nuevas correctas, SQLite y Graph simulado |
| `npm run test:gmail-pilot` | 12 comprobaciones correctas, MIME/IMAP simulado y transacciones reales |
| `npm run test:local-schema` | Bases nuevas y antiguas con datos, actualización interrumpida, idempotencia y parada ante temporales con datos correctas |
| `npm run typecheck` y `npm run check:domain` | Correctos |
| `npm run build` | Completado |
| Generación de migración con `--skip-empty` | Sin diferencias pendientes entre configuración y snapshot PostgreSQL |
| `npm run mail:pilot` desactivado | Termina con `status: disabled` sin abrir la base |
| `git diff --check` | Correcto |

Las nuevas comprobaciones cubren permisos, borrado de salidas en los tres estados, programas con y sin salidas, selección múltiple, copia comercial en auditoría, conservación de referencias, confirmaciones obsoletas y reversión completa ante un fallo. En el piloto cubren saldo compartido, A petición, confirmaciones, modificaciones, cancelaciones, vencimientos, duplicados y reenvíos, orden de eventos, errores a mitad de transacción, dos solicitudes concurrentes, privacidad, recuperación incremental, cursor vencido, exclusión entre lectores y programas eliminados o reemplazados.

Con gstack browse se verificó el panel en un servidor local con una base desechable: diálogo de retiro de 480 px centrado en 1280×720; ancho de 343 px con márgenes de 16 px en móvil de 375×812; explicación obligatoria para Otro; Escape y devolución de foco; recorrido con Tab dentro del diálogo; acciones desde fila, ficha y selección; retiro persistido; borrado de un programa y sus dos salidas con listado actualizado y cantidades reales. Las capturas locales están en `.qa/panel-pilot-evidence/`, fuera de Git. La consola mostró advertencias de precarga CSS de Next en desarrollo, sin errores de aplicación observados.

La reparación de la base local existente conservó todas las columnas y los datos originales de todas las tablas, incluidos 67 programas, 280 salidas y 514 registros de historial. Se respaldó mediante la API de SQLite antes de agregar columnas y antes de reconstruir tablas. Los 514 registros anteriores se clasificaron como salidas, sin cambiar identificadores ni contenido; `departure_id` ahora admite vacío. Se verificaron índices, `integrity_check` y `foreign_key_check`. La ejecución repetida de `db:prepare:local` no genera cambios ni respaldo adicional. Con la identidad del administrador existente, las consultas de programas, salidas, historial y las colecciones del piloto funcionan con control de acceso. gstack browse confirmó que el admin de la base existente carga su formulario de ingreso sin el error de esquema. No se introdujeron contraseñas ni se recrearon usuarios; el inicio de sesión interactivo con esa cuenta queda sin verificar.

La comparación posterior al arranque del admin mantiene idénticas las 26 tablas originales de datos. El único cambio adicional es `payload_migrations.updated_at` de la fila interna `dev`, que Payload renueva automáticamente al comprobar el esquema en desarrollo; sus demás campos permanecen iguales.

Gmail cubre selección sin filtro de leído/no leído, reenvíos de texto y HTML, conflictos multipart, deduplicación, reanudación tras fallo, cambio de UIDVALIDITY, autenticación fallida sin filtración de secretos, exclusión entre lectores, carpeta obligatoriamente de solo lectura, más de 500 UIDs con continuación y reversión del movimiento junto con el cursor. Se verificó que los cupos públicos siguen intactos y los registros no guardan cuerpos, asuntos ni pasajeros. ImapFlow instalado usa `EXAMINE` y `BODY.PEEK` para las opciones configuradas.

Quedan pendientes la ejecución de las migraciones en PostgreSQL de staging, configurar y probar la cuenta Gmail y el reenvío real, validar correos completos anonimizados y realizar los siete días de simulación conciliada. Las pruebas simuladas no acreditan esos accesos. Microsoft Graph permanece como alternativa desactivada; Convertalk permanece como evaluación de viabilidad. La actualización de cupos públicos se implementará en una etapa posterior, según la decisión confirmada para esta entrega.
