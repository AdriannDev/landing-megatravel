# Verificación de banners, popup y correos observados

Validación local del 13 de noviembre de 2026 con Node 24.22.1. Se utilizaron bases aisladas, mensajes anonimizados y transportes simulados. No se conectó el buzón real, no se cambió su configuración y no se activó ni reinició el cron.

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 100 pruebas unitarias |
| `npm run test:integration` | 83 comprobaciones del CMS |
| `npm run test:panel-pilot` | 23 comprobaciones de permisos, transacciones y Graph simulado |
| `npm run test:gmail-pilot` | 23 comprobaciones de MIME/IMAP simulado, cupos reales en una base de prueba y concurrencia |
| `npm run test:local-schema` | Base nueva y actualización de base antigua con historial, blog y correos heredados; idempotencia, índices e integridad |
| `npm run typecheck`, `check:source`, `check:domain` | Correctos |
| `npm run build` | Compilación de producción completa; sin la ruta manual del piloto |
| Migraciones PostgreSQL con PGlite | Cadena completa, datos anteriores conservados, reversión protegida y reaplicación |
| `git diff --check` | Correcto |

Las pruebas de correo cubren el mínimo MTPE/cantidad/estado, localizadores equivalentes, asunto, HTML sin separadores, reenvíos en línea y adjuntos, diferencias entre texto y HTML, datos parciales conservados, reservas distintas con igual cantidad, cambios activos, cancelaciones conocidas y desconocidas, cantidades incompatibles, duplicados, fechas opcionales, saldo insuficiente y MTPE inexistente. La reversión incluye saldo, reserva, historial, evento y progreso. Dos trabajadores que compiten por cupos no pueden producir un saldo negativo. Los lectores y registros técnicos mantienen sus identificadores.

La comprobación visual se realizó con **gstack browse**, usando su Chromium en Windows:

- Hero y rompetráfico con imágenes móviles completas, ausentes y mezcladas a 390, 760, 761 y 1440 px; cambio de ancho sin errores de hidratación. Sin imágenes móviles, no quedan carruseles ni contenedor entre tarjetas hasta 760 px. Desde 761 px reaparecen todos. Se comprobó el avance de ambos carruseles a los seis segundos.
- Popup de imagen y texto con zonas separadas, borde y separación calculados de cero; la imagen coincide con su zona. En Solo imagen, imagen y popup miden 358 × 268,5 px en móvil y 680 × 510 px en escritorio para un original 1200 × 900. Cierre enfocado al abrir, Escape y botones accesibles.
- Vista previa de ambos formatos, móvil y escritorio: imagen sin franjas y tamaño proporcional en Solo imagen.
- Paginación seleccionada con fondo y borde `rgb(0, 73, 252)` y texto blanco.
- Correos observados distingue bloqueos y advertencias aplicadas y muestra los metadatos previstos. El acceso público a las cuatro colecciones devuelve 403; las pruebas del CMS también rechazan editores. GET y POST del endpoint manual retirado devuelven 404.

Las capturas de prueba se guardaron en `.qa/approved-ui/`. La migración `20261113_161026_correos_observados` está preparada; falta aplicarla y comprobarla en PostgreSQL de staging antes de un despliegue. PGlite no acredita la conexión al PostgreSQL real ni la autenticación del buzón.
