# Estado y próximos pasos

Última revisión de servicios: 4 de noviembre de 2026. La configuración y los datos pueden cambiar después de esa fecha.

## Comprobado

- El proyecto Railway contiene una aplicación Next.js/Payload y PostgreSQL con volumen persistente. El servicio web usa la conexión privada, el catálogo CMS y el dominio Railway.
- El despliegue automático está activado para `main`. El último despliegue revisado correspondía al commit `cd7dc98`; cualquier cambio posterior requiere comprobar su propio resultado en Railway.
- Las primeras siete migraciones PostgreSQL estaban aplicadas. La migración posterior para R2 aún no se ha aplicado. `/api/health` respondió correctamente y el catálogo público mostró las salidas vigentes.
- El entorno local revisado usa SQLite, separado de PostgreSQL de producción. La integración se verifica con otra SQLite y medios aislados bajo `.qa`.

## Pendiente de operación

1. Rotar el secreto de Payload y la contraseña de PostgreSQL expuestos en la salida técnica de una revisión. Seguir [la guía de Railway](guia-railway-operacion.md).
2. Configurar R2, recuperar las imágenes que faltan y probar un redespliegue. La optimización automática de cargas nuevas está implementada localmente; seguir [R2 e imágenes](r2-imagenes.md), incluida la migración de esquema previa al despliegue.
3. Configurar copias, probar la restauración en un destino independiente y mantener copias de los archivos.
4. Configurar el chequeo de salud efectivo en Railway y revisar la migración de `railway.toml` antes de su retirada. El endpoint existe, pero el servicio revisado no tenía configurado el chequeo.
5. Configurar la tarea de retiros y el correo transaccional. El catálogo filtra las salidas vencidas aun sin cron, pero su retiro administrativo no queda registrado automáticamente.

Las migraciones futuras deben probarse y aplicarse de forma explícita: un push no ejecuta `npm run migrate`. Antes de cada despliegue revisa pruebas, cambios de esquema, copias y el estado final de Railway. Las instrucciones históricas de preparación siguen en Git; no describen necesariamente el estado actual.
