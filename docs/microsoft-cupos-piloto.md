# Piloto Microsoft de cupos por correo

La opción vigente es [Gmail dedicado con Railway](gmail-cupos-piloto.md). Este conector permanece como alternativa desactivada; para usarlo hay que seleccionar explícitamente `SEAT_MAIL_PROVIDER=microsoft-graph`.

Este conector funciona exclusivamente en **simulación**, sobre saldos conciliados ya existentes. Las herramientas manuales del piloto fueron retiradas; las colecciones técnicas se conservan ocultas. **Administración → Correos observados**, solo para administradores, muestra bloqueos y advertencias. Gmail mantiene la opción de cupos reales descrita en su guía.

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

Se mantienen el saldo verificado, responsable y fecha de corte existentes. El sistema no copia el saldo público ni reinicia saldos. Un aviso anterior o igual al corte queda observado. Una cancelación desconocida necesita revisión; el primer estado activo puede descontar sin aviso previo de creación.

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

Son obligatorios MTPE, cantidad explícita y estado. La fecha de salida es obligatoria salvo fecha única registrada; identifica origen si hay varios para ese día. Tipo, fecha comercial y versión son opcionales. A petición, Reserva y Pendiente de confirmar son activos; un cambio de cantidad aplica solo la diferencia. Cancelado y Anulado liberan únicamente cupos de una reserva conocida, con cantidad cero o igual a la conocida. Se mantienen compatibles Confirmada y Vencida. No se cuentan pasajeros.

Si existe fecha comercial, exige zona horaria. Versión y fecha comercial permiten detectar avisos antiguos; cuando faltan, se utiliza la recepción persistente de Graph. MTPE identifica el programa; el saldo simulado se concilia y actualiza por salida original (fecha y origen). El localizador usa el campo `reservation` y admite etiquetas equivalentes. Sin localizador, un estado activo se aplica por mensaje con advertencia; una cancelación queda bloqueada. Se conserva la identidad original del programa para detectar borrados y reemplazos.

| Evento | Saldo partiendo de 15 |
| --- | --- |
| Reserva A petición de 3 | 12 |
| Confirmación de las mismas 3 | 12 |
| Modificación a 2 | 13 |
| Cancelación de las 2 restantes | 15 |

Las demás reservas siguen reteniendo sus propias sillas. Se deduplican mensajes y eventos comerciales, incluidos reenvíos con otro ID. Avisos incompletos, contradictorios, antiguos, de remitentes no permitidos, sin salida coincidente o con saldos incoherentes pasan a **Revisión de correo**. Borrar un mensaje no cancela una reserva. Las incidencias se inspeccionan y concilian con operaciones; no se reinterpretan automáticamente como autorizaciones para sumar cupos.

Se guardan asunto, remitente, recepción y campos comerciales normalizados, junto con huellas, motivos y saldos. Los cuerpos completos y adjuntos permanecen en el buzón; no se extraen listas de pasajeros ni credenciales. Consulta las [reglas compartidas de procesamiento](gmail-cupos-piloto.md#saldo-inicial-plantillas-y-validación).

## Recuperación y concurrencia

El cursor se guarda por tenant, buzón y carpeta. Cada página y sus eventos se confirman en una transacción. Un fallo repite la página sin duplicar movimientos; una reserva temporal evita lectores simultáneos. Se leen hasta diez páginas por ejecución. Los enlaces incrementales se validan antes de enviar credenciales. HTTP 410 borra solo el cursor para repetir la lectura completa en la próxima tarea conservando la deduplicación. HTTP 429, 5xx y errores de acceso conservan el progreso y devuelven error.

La reserva del lector dura nueve minutos y se renueva por página. PostgreSQL serializa los movimientos mediante un bloqueo transaccional entre procesos. SQLite local usa `IMMEDIATE` y una cola de escritores dentro del proceso; la contención externa falla sin avanzar el cursor.

Antes de usar esta alternativa, contrastar los movimientos simulados con Meganet desde un corte conciliado. Leer el buzón no acredita conciliación. El modo real sigue disponible únicamente con Gmail. Esta entrega conserva la configuración actual y no activa ni reinicia lectores o cron.

Validación: `npm test`, `npm run test:integration`, `npm run test:panel-pilot`, `npm run typecheck`, `npm run build`. Las pruebas usan SQLite aislado y respuestas Graph simuladas. Validar en staging la migración `20261110_185708_panel_deletion_and_mail_pilot`, con respaldo previo. La reversión se rechaza si existen datos del piloto o auditoría ampliada para evitar perder historial.
