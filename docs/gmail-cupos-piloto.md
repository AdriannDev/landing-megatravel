# Gmail dedicado y piloto automático en Railway

El servicio lee los avisos de Gmail y trabaja en simulación por defecto. El modo real actualiza el saldo de cupos del programa, que comparten sus fechas y orígenes. Microsoft Graph sigue disponible para simulación con `SEAT_MAIL_PROVIDER=microsoft-graph`. [Guía de Microsoft Graph](microsoft-cupos-piloto.md).

## Preparar el buzón y los reenvíos

1. Crear un Gmail exclusivo para avisos de Meganet. Activar la verificación en dos pasos y generar una contraseña de aplicación si la cuenta lo permite. Introducirla directamente en las variables privadas de Railway. No usar la contraseña habitual ni compartirla por mensajes o Git. Google describe los requisitos y las posibles restricciones de cuenta en [Contraseñas de aplicación](https://support.google.com/accounts/answer/185833?hl=es).
2. Configurar en el buzón de origen el reenvío automático al Gmail dedicado. Completar la confirmación de reenvío y comprobar que llegan **reservas, modificaciones, confirmaciones, cancelaciones y vencimientos** completos. Revisar filtros y spam en ambos extremos. El lector solo ve la carpeta configurada.
3. Conservar MTPE, cantidad explícita y estado; preferir un localizador de reserva. Se admite texto, tablas HTML, asunto, reenvío en línea y un único `.eml` adjunto (hasta tres niveles). Salida, tipo, fecha comercial y versión son opcionales. Los adjuntos múltiples o ambiguos quedan observados.
4. Configurar `SEAT_MAIL_ALLOWED_SENDERS` con las direcciones reales del encabezado externo `From` observado tras el reenvío. Algunos reenvíos conservan el remitente original y otros utilizan el reenviador. Una línea `De:` dentro del cuerpo no autoriza el mensaje. Evitar remitentes compartidos de uso general y comprobar su procedencia antes de habilitar el piloto.
5. Validar las plantillas con correos completos anonimizados. Los campos ausentes, las contradicciones y las partes texto/HTML que no identifican el mismo evento pasan a revisión. No se deducen sillas de listas de pasajeros.

## Configuración privada

| Variable | Valor |
| --- | --- |
| `SEAT_MAIL_PILOT_ENABLED` | `false` pausa la lectura. `true` la habilita en el modo configurado |
| `SEAT_MAIL_PROVIDER` | `gmail-imap` |
| `SEAT_MAIL_MODE` | `simulation` por defecto o `live` para actualizar los cupos del programa |
| `SEAT_MAIL_LIVE_FROM` | Fecha y hora de inicio con zona horaria. Requerida en modo real |
| `SEAT_MAIL_LIVE_MTPES` | Códigos MTPE separados por comas. Vacío habilita todos los programas elegibles |
| `GMAIL_USER` | Dirección del Gmail dedicado |
| `GMAIL_APP_PASSWORD` | Contraseña de aplicación privada; se admiten espacios de presentación |
| `GMAIL_FOLDER` | `INBOX` por defecto |
| `SEAT_MAIL_ALLOWED_SENDERS` | Direcciones completas externas permitidas, separadas por comas |
| `DATABASE_URL` | El mismo PostgreSQL persistente del CMS |
| `PAYLOAD_SECRET` | El mismo secreto privado del CMS, al menos 32 caracteres |

No usar prefijos `NEXT_PUBLIC_` para estas variables. En Railway usar `NODE_ENV=production` y PostgreSQL, sin `USE_SQLITE=true`. El conector fija `imap.gmail.com:993`, TLS y validación del certificado. Abre la carpeta mediante `EXAMINE` de solo lectura y recupera el cuerpo con `PEEK`; no marca, mueve, borra ni envía correo. La contraseña de aplicación permite acceso a la cuenta según los permisos de Google: el modo de solo lectura lo impone este lector, por lo que el buzón dedicado debe contener únicamente avisos del piloto.

## Servicio programado de Railway

1. Respaldar PostgreSQL y ejecutar las migraciones del CMS con `npm run migrate` antes del despliegue. Incluyen `20261110_185708_panel_deletion_and_mail_pilot`, `20261110_210000_gmail_mail_cursor` y `20261113_161026_correos_observados`. La última agrega metadatos opcionales y conserva reservas, huellas y cursores. Verificar primero en staging; la validación con PGlite y SQLite no sustituye esa conexión.
2. Crear un **servicio cron separado**, con el mismo repositorio y base PostgreSQL. Configurar los ajustes del cron en Railway. El Dockerfile incluye el código, `tsx`, ImapFlow y MailParser que usa el comando.
3. Configurar `npm run mail:pilot`, frecuencia `*/10 * * * *`, reinicio `NEVER` y sin healthcheck HTTP. No cambiar el cron de retiros ni poner un bucle o temporizador dentro del servidor web. Con el piloto deshabilitado el comando termina antes de importar el CMS o abrir Gmail/la base.
4. Mantener la configuración existente de buzón y cron. Esta entrega no los activa ni reinicia. Revisar los resultados del cron y **Administración → Correos observados**, disponible solo para administradores. Las colecciones técnicas de saldos simulados, reservas y lectores están ocultas; las herramientas manuales del piloto y su endpoint fueron retirados.

El proceso se ejecuta aunque no lleguen avisos y puede procesar varios correos al día o a la semana. Cada ejecución procesa hasta **500 mensajes** en orden de UID; el siguiente cron continúa con el resto. Los mensajes nuevos que lleguen durante una ejecución se leen en esa ejecución o en la siguiente. Las tareas no son instantáneas ni garantizan el minuto exacto de ejecución. [Cron de Railway](https://docs.railway.com/reference/cron-jobs).

## Recuperación, deduplicación y privacidad

El estado persistente guarda proveedor, huella del buzón/carpeta, UIDVALIDITY y último UID. Se seleccionan mensajes leídos y no leídos. El movimiento, la reserva, el historial y el progreso del lector se confirman en **la misma transacción**. Un fallo conserva lo confirmado y repite solo lo pendiente. Los mensajes se deduplican por ID del buzón y, cuando existe, por Message-ID original. Con localizador y versión o fecha comercial también se deduplica el evento. No vaciar las colecciones técnicas para reiniciar el lector.

Una reserva del lector de nueve minutos se renueva por mensaje. PostgreSQL usa un bloqueo transaccional entre procesos; SQLite local serializa escritores. Un trabajador que pierde la reserva no puede avanzar el cursor. Los mensajes borrados de la carpeta nunca se interpretan como cancelaciones. Errores de autenticación y conexión devuelven un error sin exponer credenciales, cuerpos ni respuestas privadas del servidor, y liberan la reserva cuando el proceso puede terminar normalmente; tras una interrupción abrupta la reserva vence automáticamente.

Se guardan asunto, remitente, fecha persistente de recepción, campos comerciales normalizados, huellas, saldos, resultado y motivo. El cuerpo completo y los adjuntos permanecen en el buzón. Los pasajeros no se extraen. Los mensajes mayores a 5 MB y los MIME ilegibles quedan observados sin almacenar su contenido.

## Saldo inicial, plantillas y validación

En modo real se usa el saldo registrado del programa. Los saldos simulados existentes siguen disponibles para la automatización, sin formulario manual para crearlos o reiniciarlos. Los avisos anteriores o iguales al corte quedan observados. Un correo mínimo válido es:

```text
MTPE: MTPE-50026
Localizador: DEMO-001
Sillas: 3
Estado: A petición
```

La primera recepción de **A petición**, **Reserva** o **Pendiente de confirmar** descuenta. Con el mismo MTPE y localizador, otro estado activo con igual cantidad no descuenta otra vez; una cantidad diferente aplica solo la diferencia. Se reconocen también «Código de reserva», «Número de reserva» y «Referencia de reserva». Dos localizadores distintos se procesan independientemente aunque coincidan cantidad y estado.

**Cancelado** o **Anulado** devuelve únicamente los cupos ocupados de una reserva conocida. La cantidad explícita debe ser cero o coincidir con la cantidad conocida. Una cancelación desconocida, sin localizador o con cantidad incompatible queda observada. Se mantienen compatibles Confirmada y Vencida.

**Sin localizador**, los estados activos se aplican por mensaje y aparecen con **Advertencia: movimiento aplicado**. No se vinculan automáticamente con otros avisos. Un reenvío con otro Message-ID sin localizador se considera otro mensaje; conserva el identificador original para evitar descuentos independientes. Con localizador, un estado activo posterior a una cancelación vuelve a ocupar únicamente la cantidad indicada, siempre que supere las comprobaciones de orden.

La salida es opcional; si se indica, debe existir para ese MTPE. No se cuentan pasajeros. Campos principales ausentes o contradictorios, discrepancias entre texto y HTML, MTPE inexistente y saldo insuficiente producen **Movimiento bloqueado**. Los campos reconocidos se conservan para identificar el aviso. Versión y fecha comercial detectan eventos antiguos cuando existen; si faltan, se usan UID y fecha persistente del mensaje. Una fecha escrita dentro de un reenvío no reemplaza esos metadatos.

Ejecutar `npm test`, `npm run test:integration`, `npm run test:panel-pilot`, `npm run test:gmail-pilot`, `npm run test:local-schema`, `npm run typecheck` y `npm run build`. Las pruebas Gmail usan MIME y transporte IMAP simulados con transacciones reales de Payload; no acreditan la autenticación de una cuenta real ni las plantillas de Meganet.

## Probar con los cupos del programa

En **Programas**, verifica la cantidad de sillas del MTPE. El lector toma ese saldo como base y registra los movimientos en el historial. Un primer estado activo se procesa incluso sin un aviso previo de reserva; una cancelación necesita un descuento previo conocido.

En el servicio `correo-piloto`, configura `SEAT_MAIL_MODE=live` y `SEAT_MAIL_LIVE_FROM` con el instante a partir del cual quieres aplicar movimientos, por ejemplo `2026-11-10T19:00:00-05:00`. Para limitar la prueba a MAGIA TURCA usa `SEAT_MAIL_LIVE_MTPES=20141`. Activa `SEAT_MAIL_PILOT_ENABLED=true` tras aplicar el despliegue que incluye el modo real. Envía el aviso con una fecha de evento posterior al inicio configurado.

El modo real requiere un remitente permitido y un resultado DMARC válido de Gmail para su dominio. Consulta el detalle de los avisos para detectar reenvíos que requieran revisión. El historial de mensajes y reservas reales usa identificadores propios para que los registros de simulación no interfieran con los descuentos.

Tras una reserva de tres sillas desde un saldo registrado de nueve, comprueba **6** en Programas y el historial con el responsable «Automatización de cupos por Gmail». Repetir el mismo mensaje conserva el saldo. Una cancelación válida devuelve sus tres sillas. **Correos observados** lista únicamente bloqueos y advertencias, distinguiendo claramente si el movimiento se aplicó. `SEAT_MAIL_PILOT_ENABLED=false` pausa las próximas lecturas.

## Reparación de SQLite local

Con el servidor detenido, `npm run db:prepare:local` prepara columnas heredadas y completa el esquema actual. `npm run dev` lo ejecuta automáticamente antes de arrancar. Solo actúa con `USE_SQLITE=true` fuera de producción y acepta archivos locales persistentes.

Usa el respaldo de SQLite, que incluye datos pendientes en WAL. Conserva todas las columnas y datos originales, índices e integridad referencial y detiene el arranque ante advertencias destructivas. Solo retira tablas temporales conocidas y vacías; si contienen registros, conserva el respaldo y detiene la reparación. Los registros antiguos del historial se clasifican como salidas y se permite `departure_id` vacío para auditorías de programas. No reinicia la base ni recrea usuarios.

Los respaldos están en `backups/antes-esquema-programas-*.sqlite.db` y `backups/antes-reconstruccion-*.sqlite.db`. Para recuperar uno, detener todos los procesos del CMS y restaurar el archivo completo mediante el procedimiento de respaldo local; no sobrescribir una base abierta ni mezclarla con diarios WAL de otra copia.
