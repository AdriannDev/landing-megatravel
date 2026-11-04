# Estado y próximos pasos

Última revisión de servicios: 4 de noviembre de 2026. La configuración y los datos pueden cambiar después de esa fecha.

## Comprobado

- El proyecto Railway contiene una aplicación Next.js/Payload y PostgreSQL con volumen persistente. El servicio web usa la conexión privada, el catálogo CMS y el dominio Railway.
- El despliegue automático está activado para `main`. El despliegue revisado correspondía al commit `78b8200`; cualquier cambio posterior requiere comprobar su propio resultado en Railway. El servicio web tiene `npm run migrate` como paso previo al despliegue y ese paso terminó correctamente en la revisión.
- El servicio web tiene configurado `/api/health` con espera de 120 segundos. El endpoint respondió `status: ok`, `mode: cms`, y el catálogo público mostró las salidas vigentes.
- El servicio `retiros-automaticos` está programado diariamente a las 05:00 UTC (00:00 en Lima). Una ejecución manual revisó 10 salidas, retiró 0 y terminó sin errores. Ver [retiro programado](operacion.md#retiro-programado).
- El entorno local revisado usa SQLite, separado de PostgreSQL de producción. La integración se verifica con otra SQLite y medios aislados bajo `.qa`.

## Pendiente de operación

1. Rotar el secreto de Payload y la contraseña de PostgreSQL expuestos en la salida técnica de una revisión. Seguir [la guía de Railway](guia-railway-operacion.md).
2. Validar la configuración de R2, recuperar las imágenes que faltan y probar cargas y redespliegue. Seguir [R2 e imágenes](r2-imagenes.md) y comprobar la migración de esquema correspondiente.
3. Configurar copias, probar la restauración en un destino independiente y mantener copias de los archivos.
4. Revisar y migrar la configuración heredada de `railway.toml` antes del 1 de diciembre de 2026, fecha anunciada por Railway para su retirada. Comprobar entonces el constructor Docker, la salud y la política de reinicio.
5. Configurar el correo transaccional y supervisar periódicamente las ejecuciones del cron.

Las migraciones futuras deben probarse y revisarse antes de desplegar: la configuración actual ejecuta `npm run migrate` antes del arranque web. Verifica ese paso y el estado final de Railway después de cada despliegue. Las instrucciones históricas de preparación siguen en Git; no describen necesariamente el estado actual.
