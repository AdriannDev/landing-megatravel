# Piloto Microsoft de cupos por correo

La opción vigente es [Gmail dedicado con Railway](gmail-cupos-piloto.md). Este conector permanece como alternativa desactivada; para usarlo hay que seleccionar explícitamente `SEAT_MAIL_PROVIDER=microsoft-graph`.

La entrega funciona exclusivamente en **simulación**. En **Administración → Piloto de correo** se registra un saldo inicial y se prueban avisos anonimizados. Los saldos, reservas y avisos son privados para administradores. No se modifican los cupos públicos ni su fecha de revisión.

## Comprobaciones de TI

1. Confirmar el buzón en **Exchange Online**, desde Centro de administración de Exchange → Destinatarios → Buzones. Identificar si es de usuario o compartido. El MX de Microsoft no descarta una configuración híbrida.
2. Identificar a quien pueda registrar aplicaciones en Microsoft Entra y administrar permisos de Exchange. El acceso a Outlook no concede estas facultades.
3. Preparar un buzón dedicado y una carpeta conocida. Debe recibir todos los avisos de reserva, modificación, confirmación, cancelación y vencimiento.
4. Registrar una aplicación empresarial sin usuario conectado. Obtener tenant ID, client ID, credencial de aplicación y fecha de vencimiento; configurar su rotación. La autenticación usa client credentials con `https://graph.microsoft.com/.default`.
5. Conceder **Application Mail.Read** mediante **Application RBAC de Exchange Online**, limitado al buzón dedicado. No se necesitan envío ni escritura. `Mail.ReadBasic` no permite extraer el cuerpo. Revisar que los permisos globales de Entra no amplíen el alcance, pues las concesiones por distintas vías pueden sumarse.
6. Probar lectura del buzón autorizado y rechazo en otro buzón. Comprobar el principal y los recursos con `Test-ServicePrincipalAuthorization`; conservar evidencia de ambas lecturas antes de habilitar la tarea.

Referencias: [autenticación de aplicación](https://learn.microsoft.com/en-us/graph/auth-v2-service), [Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac), [lectura incremental](https://learn.microsoft.com/en-us/graph/api/message-delta?view=graph-rest-1.0).

## Configuración privada

| Variable | Valor o uso |
| --- | --- |
| `SEAT_MAIL_PILOT_ENABLED` | `false` inicialmente; `true` habilita lectura en simulación |
| `MS_TENANT_ID` | Tenant Microsoft Entra |
| `MS_CLIENT_ID` | Aplicación autorizada por TI |
| `MS_CLIENT_SECRET` | Credencial privada y con vencimiento controlado |
| `MS_MAILBOX_ID` | ID o dirección del buzón dedicado |
| `MS_MAIL_FOLDER_ID` | ID de carpeta o `Inbox` |
| `SEAT_MAIL_ALLOWED_SENDERS` | Direcciones completas permitidas, separadas por comas |

También se necesitan `DATABASE_URL` y `PAYLOAD_SECRET` del CMS. Introducir las credenciales directamente en el entorno privado; nunca usar variables `NEXT_PUBLIC_*`, Git ni mensajes para compartirlas.

Crear un servicio cron **separado** en Railway con el mismo repositorio y PostgreSQL y seleccionar `/railway.mail-pilot.toml` como archivo de configuración. Comando: `npm run mail:pilot`. Frecuencia: `*/10 * * * *`. No usar un healthcheck HTTP para este proceso que termina al completar la lectura. Mantener `SEAT_MAIL_PILOT_ENABLED=false` hasta completar los accesos: así el comando termina antes de conectar Microsoft o abrir la base. No se cambia el cron de retiros. Railway no garantiza ejecución exacta al minuto. [Tareas programadas](https://docs.railway.com/reference/cron-jobs).

## Saldo inicial y plantillas

Registrar un saldo verificado y fecha de corte en el panel. Se conserva el responsable. El sistema no copia automáticamente el saldo público ni reinicia saldos existentes. Un evento anterior o igual al corte requiere revisión. También requieren revisión las modificaciones, confirmaciones y cancelaciones de reservas desconocidas.

Faltan correos completos **anonimizados** de reserva, modificación y cancelación para adaptar el lector al formato real. La captura parcial de MTPE-50026 no demuestra la referencia de reserva ni cómo se expresan las sillas. El extractor preparado admite texto y HTML tabular con campos explícitos como:

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

Tipos: reserva, modificación, confirmación, cancelación y vencimiento. Estados: A petición, Confirmada, Cancelada y Vencida. Cancelación y vencimiento equivalen a cero sillas retenidas y no requieren una cantidad explícita. No se cuentan pasajeros para deducir sillas. Una confirmación que cambia la cantidad requiere revisión.

La fecha de evento exige zona horaria; no se usa la recepción o el reenvío para ordenar cambios. La versión es opcional, pero mezclar eventos con y sin versión en una misma reserva requiere revisión. El MTPE identifica un único saldo compartido por todas las fechas y orígenes. La fecha comprueba que existe una salida. Se conserva el ID original del programa para detectar borrados y reemplazos con el mismo código.

| Evento | Saldo partiendo de 15 |
| --- | --- |
| Reserva A petición de 3 | 12 |
| Confirmación de las mismas 3 | 12 |
| Modificación a 2 | 13 |
| Cancelación de las 2 restantes | 15 |

Las demás reservas siguen reteniendo sus propias sillas. Se deduplican mensajes y eventos comerciales, incluidos reenvíos con otro ID. Avisos incompletos, contradictorios, antiguos, de remitentes no permitidos, sin salida coincidente o con saldos incoherentes pasan a **Revisión de correo**. Borrar un mensaje no cancela una reserva. Las incidencias se inspeccionan y concilian con operaciones; no se reinterpretan automáticamente como autorizaciones para sumar cupos.

Solo se guardan campos comerciales normalizados, huellas de mensajes/eventos, motivos y saldos. Los cuerpos, asuntos, listas de pasajeros y credenciales no se almacenan en los registros del piloto.

## Recuperación y concurrencia

El cursor se guarda por tenant, buzón y carpeta. Cada página y sus eventos se confirman en una transacción. Un fallo repite la página sin duplicar movimientos; una reserva temporal evita lectores simultáneos. Se leen hasta diez páginas por ejecución. Los enlaces incrementales se validan antes de enviar credenciales. HTTP 410 borra solo el cursor para repetir la lectura completa en la próxima tarea conservando la deduplicación. HTTP 429, 5xx y errores de acceso conservan el progreso y devuelven error.

La reserva del lector dura nueve minutos y se renueva por página. PostgreSQL serializa los movimientos mediante un bloqueo transaccional entre procesos. SQLite local usa `IMMEDIATE` y una cola de escritores dentro del proceso; la contención externa falla sin avanzar el cursor.

Ejecutar **siete días** de simulación desde un corte conciliado y contrastar cada movimiento con Meganet. Leer el buzón no acredita conciliación. Esta entrega no incluye una vía para activar movimientos públicos; esa etapa requiere implementación y autorización posteriores.

Validación: `npm test`, `npm run test:integration`, `npm run test:panel-pilot`, `npm run typecheck`, `npm run build`. Las pruebas usan SQLite aislado y respuestas Graph simuladas. Validar en staging la migración `20261110_185708_panel_deletion_and_mail_pilot`, con respaldo previo. La reversión se rechaza si existen datos del piloto o auditoría ampliada para evitar perder historial.
