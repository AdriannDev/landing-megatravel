# Gmail dedicado y piloto automático en Railway

El servicio lee los avisos y actualiza **saldos simulados** automáticamente. No modifica los cupos públicos. Usa un saldo por programa compartido por todas sus fechas y orígenes. Microsoft Graph sigue disponible como alternativa explícita con `SEAT_MAIL_PROVIDER=microsoft-graph`; ver [su guía](microsoft-cupos-piloto.md).

## Preparar el buzón y los reenvíos

1. Crear un Gmail exclusivo para avisos de Meganet. Activar la verificación en dos pasos y generar una contraseña de aplicación si la cuenta lo permite. Introducirla directamente en las variables privadas de Railway. No usar la contraseña habitual ni compartirla por mensajes o Git. Google describe los requisitos y las posibles restricciones de cuenta en [Contraseñas de aplicación](https://support.google.com/accounts/answer/185833?hl=es).
2. Configurar en el buzón de origen el reenvío automático al Gmail dedicado. Completar la confirmación de reenvío y comprobar que llegan **reservas, modificaciones, confirmaciones, cancelaciones y vencimientos** completos. Revisar filtros y spam en ambos extremos. El lector solo ve la carpeta configurada.
3. Reenviar en línea, conservando referencia de reserva, MTPE, salida, sillas, estado, tipo, fecha del evento y versión si existe. Un `.eml` adjunto requiere revisión. No reemplazar la fecha comercial por la fecha de recepción del reenvío.
4. Configurar `SEAT_MAIL_ALLOWED_SENDERS` con las direcciones reales del encabezado externo `From` observado tras el reenvío. Algunos reenvíos conservan el remitente original y otros utilizan el reenviador. Una línea `De:` dentro del cuerpo no autoriza el mensaje. Evitar remitentes compartidos de uso general y comprobar su procedencia antes de habilitar el piloto.
5. Validar las plantillas con correos completos anonimizados. Los campos ausentes, las contradicciones y las partes texto/HTML que no identifican el mismo evento pasan a revisión. No se deducen sillas de listas de pasajeros.

## Configuración privada

| Variable | Valor |
| --- | --- |
| `SEAT_MAIL_PILOT_ENABLED` | `false` hasta validar cuenta, reenvíos y saldo inicial; después `true` habilita lectura en simulación |
| `SEAT_MAIL_PROVIDER` | `gmail-imap` |
| `GMAIL_USER` | Dirección del Gmail dedicado |
| `GMAIL_APP_PASSWORD` | Contraseña de aplicación privada; se admiten espacios de presentación |
| `GMAIL_FOLDER` | `INBOX` por defecto |
| `SEAT_MAIL_ALLOWED_SENDERS` | Direcciones completas externas permitidas, separadas por comas |
| `DATABASE_URL` | El mismo PostgreSQL persistente del CMS |
| `PAYLOAD_SECRET` | El mismo secreto privado del CMS, al menos 32 caracteres |

No usar prefijos `NEXT_PUBLIC_` para estas variables. En Railway usar `NODE_ENV=production` y PostgreSQL, sin `USE_SQLITE=true`. El conector fija `imap.gmail.com:993`, TLS y validación del certificado. Abre la carpeta mediante `EXAMINE` de solo lectura y recupera el cuerpo con `PEEK`; no marca, mueve, borra ni envía correo. La contraseña de aplicación permite acceso a la cuenta según los permisos de Google: el modo de solo lectura lo impone este lector, por lo que el buzón dedicado debe contener únicamente avisos del piloto.

## Servicio programado de Railway

1. Respaldar PostgreSQL y ejecutar las migraciones del CMS con `npm run migrate` antes de activar el cron. Incluyen `20261110_185708_panel_deletion_and_mail_pilot` y `20261110_210000_gmail_mail_cursor`. Verificar primero en staging; esta entrega verifica SQLite, no una conexión real a PostgreSQL.
2. Crear un **servicio cron separado**, con el mismo repositorio y base PostgreSQL. Seleccionar `/railway.mail-pilot.toml` como configuración. El Dockerfile incluye el código, `tsx`, ImapFlow y MailParser que usa el comando.
3. Configurar `npm run mail:pilot`, frecuencia `*/10 * * * *`, reinicio `NEVER` y sin healthcheck HTTP. No cambiar el cron de retiros ni poner un bucle o temporizador dentro del servidor web. Con el piloto deshabilitado el comando termina antes de importar el CMS o abrir Gmail/la base.
4. Copiar las variables privadas anteriores. Mantener `SEAT_MAIL_PILOT_ENABLED=false` hasta completar la validación. Tras habilitarlo, revisar el resultado del cron y **Administración → Piloto de correo → Estado de lectores**.

El proceso se ejecuta aunque no lleguen avisos y puede procesar varios correos al día o a la semana. Cada ejecución procesa hasta **500 mensajes** en orden de UID; el siguiente cron continúa con el resto. Los mensajes nuevos que lleguen durante una ejecución se leen en esa ejecución o en la siguiente. Las tareas no son instantáneas ni garantizan el minuto exacto de ejecución. [Cron de Railway](https://docs.railway.com/reference/cron-jobs).

## Recuperación, deduplicación y privacidad

El estado persistente guarda proveedor, huella del buzón/carpeta, UIDVALIDITY y último UID. Se seleccionan mensajes leídos y no leídos. El movimiento, la reserva, el registro de evento y el progreso del lector se confirman en **la misma transacción**. Un fallo conserva lo ya confirmado y repite solo lo pendiente. Un cambio de UIDVALIDITY recorre la carpeta de nuevo; la huella del evento comercial impide descontar por segunda vez un reenvío o un aviso recuperado. No vaciar las colecciones del piloto para reiniciar el lector.

Una reserva del lector de nueve minutos se renueva por mensaje. PostgreSQL usa un bloqueo transaccional entre procesos; SQLite local serializa escritores. Un trabajador que pierde la reserva no puede avanzar el cursor. Los mensajes borrados de la carpeta nunca se interpretan como cancelaciones. Errores de autenticación y conexión devuelven un error sin exponer credenciales, cuerpos ni respuestas privadas del servidor, y liberan la reserva cuando el proceso puede terminar normalmente; tras una interrupción abrupta la reserva vence automáticamente.

Solo se guardan campos comerciales normalizados, huellas, saldos, resultado y motivo. No se guardan cuerpos, asuntos, adjuntos ni datos de pasajeros. Los mensajes mayores a 1 MB y los MIME ilegibles se registran para revisión sin guardar su contenido.

## Saldo inicial, plantillas y validación

Registrar en el panel un saldo conciliado y una fecha de corte anterior a los primeros avisos que se quieran simular. El sistema no copia el saldo público ni reinicia un saldo con movimientos. Los avisos anteriores o iguales al corte y los cambios de reservas desconocidas requieren revisión.

```text
MTPE: MTPE-50026
Reserva: DEMO-001
Salida: 21 nov 2026
Sillas: 3
Estado: A petición
Tipo: reserva
Fecha del evento: 2026-11-10T12:00:00-05:00
Versión: 1
```

Tipos: reserva, modificación, confirmación, cancelación y vencimiento. Estados: A petición, Confirmada, Cancelada y Vencida. Partiendo de 15, reservar 3 deja 12; confirmar las mismas 3 mantiene 12; modificar a 2 deja 13; cancelar devuelve las 2 restantes y deja 15. Un vencimiento también libera únicamente las sillas aún retenidas. Los avisos antiguos, ambiguos o contradictorios no cambian el saldo.

Ejecutar `npm test`, `npm run test:integration`, `npm run test:panel-pilot`, `npm run test:gmail-pilot`, `npm run test:local-schema`, `npm run typecheck` y `npm run build`. Las pruebas Gmail usan MIME y transporte IMAP simulados con transacciones reales de Payload; no acreditan la autenticación de una cuenta real ni las plantillas de Meganet.

Antes de plantear movimientos públicos, completar **siete días de simulación** desde un saldo conciliado y contrastar cada movimiento con Meganet. La actualización pública se implementará y habilitará en una etapa posterior.

## Reparación de SQLite local

Con el servidor detenido, `npm run db:prepare:local` prepara columnas heredadas y completa el esquema actual. `npm run dev` lo ejecuta automáticamente antes de arrancar. Solo actúa con `USE_SQLITE=true` fuera de producción y acepta archivos locales persistentes.

Usa el respaldo de SQLite, que incluye datos pendientes en WAL. Conserva todas las columnas y datos originales, índices e integridad referencial y detiene el arranque ante advertencias destructivas. Solo retira tablas temporales conocidas y vacías; si contienen registros, conserva el respaldo y detiene la reparación. Los registros antiguos del historial se clasifican como salidas y se permite `departure_id` vacío para auditorías de programas. No reinicia la base ni recrea usuarios.

Los respaldos están en `backups/antes-esquema-programas-*.sqlite.db` y `backups/antes-reconstruccion-*.sqlite.db`. Para recuperar uno, detener todos los procesos del CMS y restaurar el archivo completo mediante el procedimiento de respaldo local; no sobrescribir una base abierta ni mezclarla con diarios WAL de otra copia.
