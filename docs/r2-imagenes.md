# Activación de Cloudflare R2 para imágenes

Esta guía prepara el traslado de imágenes del CMS a R2. No crea una cuenta ni cambia el servicio. Haz el procedimiento en una ventana coordinada: desplegar la aplicación actual puede borrar sus archivos temporales y activar R2 cambia las URL de todos los registros de imágenes existentes.

## Antes de empezar

1. Comprueba en Railway que el último despliegue y PostgreSQL estén operativos. Revisa la [guía de copias y credenciales](guia-railway-operacion.md) y crea una copia de la base; prueba su recuperación en un entorno separado.
2. Guarda los archivos originales disponibles del servidor **antes de cualquier redespliegue**. El CLI de Railway permite descargar el directorio completo desde la carpeta del proyecto:

   ```powershell
   railway service files --service landing-megatravel --environment production download /app/media ./backups/railway-media
   ```

   Si el destino ya existe, elige otro nombre de carpeta para no sobrescribir el respaldo. `backups/` está excluido de Git. Este respaldo solo contiene archivos aún presentes: si un archivo ya desapareció, recupéralo desde sus originales o vuelve a cargarlo después.
3. Compara el contenido de la biblioteca **Imágenes** con los archivos recuperados, conserva los nombres y verifica cuáles faltan. No subas credenciales ni respaldos a GitHub. No compartas en el chat valores de variables o claves.

## 1. Crear el bucket en Cloudflare

1. Entra en el panel de Cloudflare y abre **R2 Object Storage**. Activa R2 según las condiciones de tu cuenta y verifica si exige un método de pago. Revisa [precios y franquicia](https://developers.cloudflare.com/r2/pricing/) antes de confirmar.
2. Crea un bucket para los archivos públicos del catálogo, por ejemplo `megatravel-imagenes`. Elige almacenamiento **Standard** y la ubicación disponible que prefieras. Copia su nombre para `R2_BUCKET`.
3. En la configuración del bucket, localiza el **S3 API endpoint** de la cuenta. Su forma general es `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; es el valor de `R2_ENDPOINT`, sin añadir el nombre del bucket ni claves.
4. Configura una dirección pública para servir exclusivamente estos archivos. Para producción, conecta un subdominio propio, por ejemplo `imagenes.tudominio.com`, mediante **Settings → Custom Domains** del bucket. El dominio debe estar en una zona administrada por Cloudflare. Si todavía no tienes dominio, puedes habilitar temporalmente la URL `r2.dev` para pruebas; Cloudflare la limita y no la recomienda para producción. La dirección completa, con `https://` y sin barra final, es `R2_PUBLIC_URL`. Consulta [buckets públicos](https://developers.cloudflare.com/r2/buckets/public-buckets/).
5. Antes de activar el adaptador en Railway, sube al bucket los archivos recuperados que sigan vinculados en el CMS **con sus nombres y rutas exactos**. Para archivos de la configuración local actual, normalmente van en la raíz del bucket; si un registro ya usa prefijo o clave de objeto, conserva esa ruta. Comprueba que algunos archivos abren con la URL pública. No des acceso público a respaldos ni documentos privados.

El adaptador genera la URL de R2 para todos los registros de `media`, incluso los creados antes de activarlo. Si el archivo no se copió a la ruta correspondiente, su URL dejará de funcionar. Si ya no existe una copia, recupérala o reemplázala en el CMS después de activar R2; no elimines los registros a ciegas.

## 2. Crear las credenciales de acceso

1. En R2 abre la administración de API tokens y crea un token de cuenta o de usuario según la política de tu organización.
2. Otorga **Object Read & Write** y limítalo al bucket creado. Consulta la [guía de tokens de R2](https://developers.cloudflare.com/r2/api/tokens/).
3. Guarda en tu gestor de contraseñas el **Access Key ID** y el **Secret Access Key**. Cloudflare indica que el secreto no se puede volver a consultar. No pegues ninguno en GitHub, un archivo del proyecto, una captura ni una conversación. El token de API no sustituye al par S3 de Access Key ID y Secret Access Key.

## 3. Desplegar el código con la migración

El nuevo código añade el campo `_objectkey` a `media`. Esta migración es necesaria incluso si todavía no activas R2, porque el campo mantiene el esquema compatible con y sin el adaptador. La migración agrega una columna opcional y conserva las filas; su reversión se detiene si hay claves R2 que deban conciliarse.

1. Con el respaldo de base y archivos hecho, revisa el historial y todas las migraciones pendientes: `npm run migrate` aplica cada migración pendiente, no solo la de R2. Abre el servicio web de Railway → **Settings → Deploy** y configura temporalmente **Pre-Deploy Command** como `npm run migrate`. Define un tiempo límite apropiado, por ejemplo 300 segundos. La configuración de Railway puede generar un despliegue: revisa los cambios antes de aplicarlos. El comando corre en la red privada; si falla, Railway no continúa con el nuevo despliegue. [Pre-deploy de Railway](https://docs.railway.com/deployments/pre-deploy-command).
2. Revisa y confirma los cambios locales en Git y haz push a la rama conectada. Antes de subir, verifica con `git status` qué cambios tuyos y anteriores entrarán en el commit. No agregues las variables R2 todavía.
3. En **Deployments**, comprueba los logs del pre-deploy. Debe aplicar `20261104_171419_r2_media_storage` sin errores y el despliegue debe terminar en `Success`. Revisa `/api/health`, el catálogo y el acceso al CMS. La migración se probó con PostgreSQL embebido, pero la ejecución contra tu PostgreSQL real debe comprobarse aquí.
4. Si prefieres no ejecutar migraciones automáticamente en futuros despliegues, retira el pre-deploy después de confirmar esta migración, revisando si Railway solicita otro despliegue. Planifica las siguientes migraciones y copias antes de aplicarlas.

Si la migración falla, no actives R2. Revisa los logs y el historial de migraciones; no ejecutes migraciones iniciales manualmente sobre la base existente. El comando nunca debe apuntar a la SQLite local ni a otra base.

## 4. Activar R2 en Railway

En el servicio web `landing-megatravel` → **Variables**, prepara las cinco variables siguientes en una sola operación y aplica los cambios juntos:

| Variable | Qué guardar |
| --- | --- |
| `R2_BUCKET` | Nombre del bucket |
| `R2_ENDPOINT` | S3 API endpoint HTTPS de la cuenta, sin el bucket |
| `R2_ACCESS_KEY_ID` | Access Key ID del token S3 |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key del token S3 |
| `R2_PUBLIC_URL` | URL HTTPS pública del bucket, sin barra final |

Conserva la referencia privada de `DATABASE_URL` y el `PAYLOAD_SECRET` existente. Nunca imprimas las variables con `railway variables --json`, `railway environment config --json`, `printenv` u otras herramientas que muestren secretos. El código rechaza una configuración R2 incompleta sin mostrar sus valores. Si una variable es sellada y no puedes inspeccionarla, no la sustituyas solo para verla.

Aplica y espera el despliegue. Verifica `/api/health`, catálogo y CMS. Abre varias imágenes antiguas y confirma que se cargan desde el dominio público de R2. Si fallan, revisa que el archivo exista con el mismo nombre/ruta en el bucket y que la URL pública corresponda al bucket correcto. Desactivar R2 cambia de nuevo la ubicación de lectura; no elimina automáticamente los archivos de R2 ni restaura los del contenedor.

## 5. Verificar una carga nueva y persistencia

1. Con una cuenta de editor, sube al CMS un flyer de prueba JPEG o PNG y registra su tamaño original. El sistema intenta guardarlo como WebP, manteniendo la proporción, sin recortar ni ampliar, con lado máximo de 1.600 px. La conversión inicial usa calidad 86; Payload puede realizar otro procesamiento antes de guardar. Si la primera conversión no reduce el tamaño, no se sustituye el archivo en esa etapa. El ahorro final depende de la imagen y debe comprobarse. GIF y WebP animados no se convierten a imagen estática. El límite sigue siendo 12 MB por carga; las imágenes procesadas tienen un límite de 40 megapíxeles.
2. Comprueba el tipo y tamaño guardados en la biblioteca o en el bucket, abre el enlace público y revisa la legibilidad de los textos. Después asocia la imagen a un programa de prueba.
3. Redespliega el servicio y confirma que el mismo enlace, el programa y la tarjeta siguen mostrando la imagen. Comprueba escritorio y móvil. El procesamiento se aplica a cargas nuevas o archivos reemplazados; copiar archivos antiguos al bucket no los optimiza automáticamente.
4. Configura alertas de uso y consulta almacenamiento y operaciones durante los primeros meses. Haz copias de los objetos de R2 por separado de PostgreSQL. No elimines el respaldo original hasta verificar las imágenes y su recuperación.

Las pruebas `npm run test:integration` y `npm run test:r2` usan SQLite y un servidor S3 simulado locales; no crean objetos en Cloudflare ni acreditan las credenciales o el dominio reales. La comprobación real requiere la cuenta y el bucket configurados.
