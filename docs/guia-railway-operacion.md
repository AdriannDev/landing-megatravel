# Railway: credenciales, imágenes y copias

Guía para el proyecto de producción revisado el 4 de noviembre de 2026. No contiene contraseñas. Los precios y los límites pueden cambiar: verifica siempre el plan y el consumo en las cuentas correspondientes.

## Preparación antes de rotar credenciales

Programa una ventana corta de mantenimiento, avisa al equipo y evita editar contenido durante el cambio. Primero crea y comprueba una copia de la base, como se explica más abajo. Ten acceso al proyecto Railway, a su servicio `Postgres`, al servicio web y al gestor de contraseñas. No pegues claves en el chat, GitHub, archivos versionados, capturas ni comandos; no ejecutes `railway variables --json`, `railway environment config --json` ni `printenv` en una salida compartida, pues muestran secretos.

En la revisión del 4 de noviembre se mostraron accidentalmente el secreto de Payload y la contraseña de PostgreSQL en la salida técnica de la sesión. Trátalos como comprometidos. No incluyas los valores antiguos ni nuevos en los registros de soporte.

## Rotar la contraseña de PostgreSQL

Cambiar `POSTGRES_PASSWORD` en Railway no modifica por sí mismo la contraseña de un PostgreSQL que ya tiene datos. Hay que cambiar la contraseña del usuario de la base y después actualizar la variable que usa la conexión. Este procedimiento implica una breve ventana en la que las conexiones nuevas podrían fallar.

1. Crea una contraseña larga y aleatoria en un gestor de contraseñas; guárdala allí. No la publiques ni la escribas en una línea de comandos.
2. Desde una terminal privada vinculada al proyecto, abre una sesión interactiva con `railway ssh --service Postgres --environment production`. Dentro del contenedor, abre `psql -U postgres -d railway`. No imprimas las variables del entorno.
3. En `psql`, ejecuta `\password postgres`. Introduce la contraseña nueva dos veces cuando se solicite; la entrada no se muestra. Sal con `\q` y luego `exit`. Verifica que el cambio haya terminado sin errores.
4. Inmediatamente abre Railway → proyecto → servicio **Postgres** → **Variables**. Actualiza `POSTGRES_PASSWORD` con el mismo valor de forma privada. Conserva las referencias existentes de `DATABASE_URL`; no copies la URL a Git ni al chat. Revisa y aplica los cambios pendientes de Railway.
5. Espera que los servicios estén activos. Abre `/api/health`: debe responder `status: ok` y `mode: cms`. Comprueba catálogo y acceso al CMS, y revisa los logs sin compartir credenciales. Si falla, revisa que la contraseña de PostgreSQL y la variable coincidan y que la referencia `DATABASE_URL` del servicio web siga apuntando al servicio Postgres. Coordina el reinicio o redespliegue necesario para que las conexiones nuevas usen el valor actualizado.

No elimines el servicio ni su volumen para cambiar la contraseña. Cambiar variables puede provocar despliegues: revisa el plan y los cambios pendientes antes de aplicarlos. Si se interrumpe la operación, completa la actualización de la variable de forma privada; no restaures una base de producción solo para cambiar una contraseña.

## Rotar el secreto de Payload

1. Genera y guarda en tu gestor un secreto nuevo aleatorio de al menos 32 caracteres. No reutilices la contraseña de PostgreSQL.
2. En Railway → servicio web `landing-megatravel` → **Variables**, actualiza `PAYLOAD_SECRET` de forma privada y aplica el cambio. Railway desplegará la nueva configuración.
3. Espera el resultado del despliegue y comprueba `/api/health`, catálogo e inicio de sesión. Las sesiones existentes pueden dejar de ser válidas; el equipo deberá volver a iniciar sesión. Si en el futuro se incorporan datos cifrados con este secreto, planifica su migración antes de rotarlo.
4. Mantén el nuevo secreto estable y fuera del repositorio. Comprueba que no haya copias del secreto anterior en archivos compartidos. La rotación no borra por sí sola la salida técnica anterior; restringe el acceso a esa conversación si corresponde.

## Opciones para imágenes

- **Cloudflare R2 Standard:** el proyecto ya tiene integración S3 preparada, pero aún hay que crear y configurar el bucket y las variables `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` y `R2_PUBLIC_URL`. La URL pública debe servir las imágenes. El nivel gratuito incluye, según [precios de R2](https://developers.cloudflare.com/r2/pricing/), 10 GB-mes de almacenamiento, un millón de operaciones de clase A y diez millones de clase B al mes. Fuera de esos límites se factura; revisa si el alta de tu cuenta requiere método de pago y configura alertas. Los números incluyen todas las copias y variantes almacenadas. R2 no comprime ni redimensiona por sí solo.
- **Volumen persistente de Railway:** montar otro volumen en `/app/media`, con permisos de escritura para el usuario `node`, y probar que sobrevive a un despliegue. Revisar disponibilidad, límites y precio del plan. El volumen de PostgreSQL no debe usarse como si fuera una carpeta compartida de la aplicación.
- **PostgreSQL:** guardar binarios en la base es técnicamente posible, pero la implementación actual guarda metadatos en PostgreSQL y archivos en disco o R2. Cambiarlo requiere desarrollo, migración y pruebas; consume espacio de la base y aumenta el tamaño de sus copias. No elimina los límites o posibles cargos de Railway.

Con imágenes de 1,2 MB, 10 GB equivalen aproximadamente a 8.300 archivos de ese tamaño almacenados durante todo el mes, sin contar variantes, otros objetos ni operaciones. No es una garantía de costo cero. La carga y el tráfico reales, los banners y las copias adicionales cambian la estimación.

El CMS procesa automáticamente las imágenes estáticas nuevas con Sharp antes de guardarlas; conserva las animaciones. R2 y [Cloudflare Images](https://developers.cloudflare.com/images/pricing/) son productos distintos. El procedimiento para configurar el bucket, aplicar la migración y verificar las cargas está en [R2 e imágenes](r2-imagenes.md).

Tras elegir almacenamiento, recupera o vuelve a subir las imágenes faltantes, comprueba sus enlaces y valida que sigan disponibles tras un redespliegue. La copia de PostgreSQL no incluye los archivos guardados en R2 o en otro volumen; respáldalos por separado.

## Configurar y comprobar copias en Railway

Según la revisión del 4 de noviembre, el volumen de PostgreSQL no tenía copias ni horarios configurados. Comprueba de nuevo el estado y el costo antes de activar servicios: las [copias de volúmenes](https://docs.railway.com/volumes/backups) se cobran por almacenamiento incremental y su disponibilidad depende del plan.

1. Abre el proyecto → servicio **Postgres** → pestaña **Backups**. Crea una copia manual y espera a verla completada. Revisa los límites de tamaño y el costo que muestra Railway.
2. En esa misma pestaña configura la frecuencia disponible y la retención que necesita el equipo. Railway documenta horarios diarios, semanales y mensuales; se pueden combinar. Comprueba que aparezca la próxima ejecución y revisa periódicamente las copias.
3. Prueba la recuperación en un proyecto o entorno de prueba separado mediante una copia lógica o el mecanismo que permita tu plan. La restauración de una copia de volumen en Railway se prepara en el mismo proyecto y entorno y, al confirmar **Deploy**, reemplaza el volumen montado y redespliega el servicio. No confirmes esa restauración sobre producción durante una prueba.
4. Verifica en el destino de prueba el acceso, recuentos, programas, salidas y enlaces de imágenes. Conserva además una copia independiente protegida de la base y de los archivos, y documenta quién la puede recuperar. Las copias del volumen no protegen contra todos los incidentes: Railway indica que borrar el volumen también borra sus copias.
5. Si se necesita recuperación entre copias, evalúa la opción de recuperación a un punto en el tiempo y su costo. No estaba activada al momento de la revisión.

La guía [Operación](operacion.md#copia-y-restauración) describe los comandos del repositorio para copias lógicas y su restauración en una base `_restore` separada. Una URL privada de Railway solo es accesible desde su red privada; no publiques PostgreSQL únicamente para hacer la copia.
