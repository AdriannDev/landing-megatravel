# Presupuesto aproximado de Railway

Estimación actualizada el 24 de octubre de 2026, en USD al mes. Objetivo: mantener o bajar el hosting actual de **USD 20/mes**. El usuario informa aproximadamente **1,000 personas al mes** en la web actual. No se consultó una cuenta de analítica: faltan sesiones, páginas vistas, peso transferido y métricas de memoria de la nueva aplicación. Los escenarios son cálculos con recursos supuestos, no mediciones de esta aplicación desplegada ni una cotización garantizada.

## Arquitectura y alcance del presupuesto

La arquitectura elegida es **Next.js con Payload como CMS, PostgreSQL para producción y Railway como alojamiento**. Primero se validará localmente el panel y sus funciones. El presupuesto de este documento corresponde a esa implementación y debe contrastarse con mediciones antes del lanzamiento.

En este proyecto, el proceso Next/Payload mantiene el panel, las sesiones y la API; PostgreSQL mantiene cuentas, salidas, relaciones, versiones e historial. Ambos conservan memoria cuando están activos. Las imágenes se almacenan como archivos en disco o en un bucket: no se mantienen todas cargadas en RAM ni se necesita guardar los binarios en PostgreSQL. Comprimirlas reduce transferencia y almacenamiento, pero no elimina el consumo base de esos procesos.

Como ejemplo aritmético, 400 imágenes de 200 KB suman aproximadamente **80 MB de almacenamiento**. No significa 80 MB de RAM ocupada permanentemente ni que cada visitante descargue las 400. El peso real y la calidad legible de los flyers deben verificarse.

La carga normal de imágenes y la administración del contenido se realizan en Payload. Ver [configuración del CMS](cms.md#cms-del-proyecto-payload) y [pruebas locales](pruebas-locales.md). La optimización de imágenes y una futura caché/publicación estática son trabajos pendientes sobre esta misma arquitectura; deben conservar la actualización de precios, los retiros de America/Lima y la privacidad del historial.

## Estimación para este catálogo

Con 1,000 visitantes mensuales y una sola instancia de aplicación/PostgreSQL, un escenario pequeño puede quedar aproximadamente en **USD 7–12/mes en Hobby**. Esta banda supone RAM media conjunta de aproximadamente 0.60–0.90 GB, CPU baja, pocos GB de datos y sin staging encendido todo el mes. Reservaría **USD 15/mes** de presupuesto inicial hasta medir. Si la aplicación/base utilizan más memoria de la supuesta, el costo puede superar esa banda aun con las mismas 1,000 personas.

Con **R2 para flyers** dentro de su franquicia, el presupuesto de memoria permanece. Para este tráfico la diferencia frente a servir imágenes desde Railway puede ser de centavos o pocos dólares, según los archivos descargados. R2 aporta sobre todo margen frente a imágenes pesadas o crecimiento del tráfico. No se debe presentar como un ahorro grande garantizado con 1,000 personas.

No se necesita una aplicación aparte para el CMS. Añadir editores en Payload no crea nuevos servidores; un segundo entorno de staging permanentemente encendido sí añade recursos facturables.

## Qué representan 1,000 personas en tráfico

Son unas 33 personas al día de promedio, no 33 usuarios simultáneos. Una persona puede visitar varias veces y abrir varios programas. Para ilustrar el ancho de banda, esta tabla supone **una visita por persona** y suma todos los archivos recibidos durante esa visita:

| Transferencia supuesta por visita | Transferencia para 1,000 visitas | Egress Railway a USD 0.05/GB |
| --- | ---: | ---: |
| 3 MB | Aproximadamente 3 GB | USD 0.15 |
| 10 MB | Aproximadamente 10 GB | USD 0.50 |
| 20 MB | Aproximadamente 20 GB | USD 1.00 |

Se usan unidades decimales para el ejemplo. Si cada persona hace tres visitas con la misma transferencia, multiplicar por tres. La caché del navegador puede reducir descargas repetidas. Estos pesos son supuestos: no se ha medido el consumo real de los flyers. La tarifa proviene de [Railway](https://docs.railway.com/pricing/plans).

Por tanto, con este volumen de visitas, el tráfico suele ser una parte pequeña del ejemplo de presupuesto. **Lo que más pesa es mantener memoria ocupada todo el mes.** Por ejemplo, 0.40 GB medios en la app y 0.20 GB en PostgreSQL suman USD 6 de RAM al mes antes de CPU, archivos y red. Es una hipótesis de dimensionamiento, no una lectura de las métricas de estos servicios.

## Contenido casi estático y servidor activo

La frecuencia de edición y la forma de servir la web son decisiones diferentes. El contenido comercial puede cambiar poco y aun así ser consultado desde un servidor y una base en cada petición.

El código actual marca `/` y `/api/public/catalog` como dinámicos. En modo CMS consulta salidas, promociones, banners y configuración; una pestaña visible vuelve a consultar cada 30 segundos. Búsqueda y filtros se realizan en el navegador. Aunque no haya visitas, una aplicación y una base mantenidas en ejecución conservan un consumo de memoria. [Cómo se factura Railway](https://docs.railway.com/pricing/understanding-your-bill).

| Forma de servir el catálogo | Efecto esperado | Trabajo necesario |
| --- | --- | --- |
| Arquitectura actual: Next/Payload y PostgreSQL activos | Poco gasto de tráfico con 1,000 personas; continúa la memoria de app/base | Desplegar y medir antes de dimensionar |
| Catálogo con caché e invalidación al editar | Menos consultas y CPU; mantiene app/base en ejecución | Invalidar tras cambios y al próximo retiro; comprobar que no se muestran salidas vencidas |

La caché está pendiente de implementación y validación. Su objetivo sería reducir consultas y CPU conservando Payload y PostgreSQL. No elimina el consumo base de memoria de esos procesos. La exportación estática de todo el proyecto tampoco sustituye las funciones de servidor del CMS. [Exportación estática de Next](https://nextjs.org/docs/app/guides/static-exports).

Railway permite suspender servicios inactivos mediante Serverless, con demora al volver a activarse. Las conexiones a PostgreSQL, telemetría y otras peticiones pueden impedir la suspensión; no se ha validado ese modo con esta aplicación y no se descuenta de la estimación. [Serverless Railway](https://docs.railway.com/deployments/serverless).

## Tarifas utilizadas

Railway publica un mínimo mensual de **USD 5 en Hobby** y **USD 20 en Pro**, con consumo incluido hasta ese mínimo. Por ejemplo, USD 12 de consumo en Hobby da USD 12 de factura, no USD 17. El mínimo es del workspace, no de cada servicio. Pro permite colaboración en la infraestructura y ya parte del presupuesto actual de USD 20. [Planes](https://docs.railway.com/pricing/plans) y [facturación](https://docs.railway.com/pricing/understanding-your-bill).

| Recurso de servicios de aplicación/base | Tarifa usada |
| --- | --- |
| Memoria media utilizada | USD 10 por GB/mes |
| CPU media utilizada | USD 20 por vCPU/mes |
| Volumen persistente | USD 0.15 por GB/mes |
| Tráfico saliente del servicio | USD 0.05 por GB |

Se factura el consumo, no simplemente el máximo de RAM/CPU permitido. Estas son tarifas de los servicios en contenedores de esta arquitectura. [Tarifas de recursos Railway](https://docs.railway.com/pricing/plans).

La fórmula orientativa para este caso es:

```text
recursos = RAM_media_GB × 10
         + CPU_media_vCPU × 20
         + volúmenes_GB_mes × 0.15
         + tráfico_saliente_GB × 0.05
         + copias + tarea_programada

factura_Hobby ≈ máximo(5, recursos)
factura_Pro   ≈ máximo(20, recursos)
```

Sumar todos los servicios y entornos del workspace. Los volúmenes y copias se expresan como almacenamiento facturable a lo largo del mes; no usar sin más el máximo de capacidad del servicio como si fuera consumo medido.

## Escenarios calculados: todo en Railway con volumen para imágenes

Un servidor de aplicación, un PostgreSQL, sin otro entorno permanente. RAM y CPU representan la suma media de aplicación y base durante el mes. El tráfico incluye flyers, HTML, JavaScript y API. La tarea se presupuesta aparte porque solo corre unos instantes al día. La columna Bajo coincide con el ejemplo de 1,000 visitas a 10 MB; las demás muestran qué pasa al variar memoria y tráfico, no predicciones basadas únicamente en visitantes.

| Concepto | Bajo | Intermedio | Mayor consumo |
| --- | ---: | ---: | ---: |
| RAM media total | 0.60 GB = 6.00 | 0.90 GB = 9.00 | 1.30 GB = 13.00 |
| CPU media total | 0.03 vCPU = 0.60 | 0.08 vCPU = 1.60 | 0.15 vCPU = 3.00 |
| Volúmenes de base e imágenes | 3 GB = 0.45 | 4 GB = 0.60 | 4 GB = 0.60 |
| Tráfico saliente mensual | 10 GB = 0.50 | 50 GB = 2.50 | 100 GB = 5.00 |
| Copias: almacenamiento incremental supuesto | 1 GB = 0.15 | 2 GB = 0.30 | 3 GB = 0.45 |
| Consumo supuesto de tarea diaria | 0.05 | 0.10 | 0.15 |
| **Factura estimada en Hobby** | **7.75** | **14.10** | **22.20** |
| **Diferencia frente a USD 20** | **12.25 menos** | **5.90 menos** | **2.20 más** |

Son ejemplos posibles, no perfiles de memoria observados. Las copias incrementales se cobran con la tarifa de volúmenes según Railway; el almacenamiento adicional real depende de los cambios y retención. [Copias de volúmenes](https://docs.railway.com/volumes/backups).

Con Pro esos mismos ejemplos serían USD 20, USD 20 y USD 22.20. Si varias personas necesitan administrar Railway, considerar ese mínimo al decidir el plan; los editores que solo trabajan en `/admin` no necesitan cuentas de infraestructura.

## Qué significa «todo en Railway» para los archivos

Hay dos caminos distintos:

| Opción | Trabajo/configuración | Efecto en costos |
| --- | --- | --- |
| Volumen de imágenes junto a la app | `R2_BUCKET` vacío, `MEDIA_DIR=/app/media`, volumen en esa ruta y prueba de permisos/persistencia | Imágenes a USD 0.15/GB-mes; sus descargas salen del servidor y suman egress |
| Bucket S3 de Railway | Requiere adaptar la integración y la entrega pública | Objetos a USD 0.015/GB-mes, operaciones y salida del bucket gratis; el tráfico que atraviese el servidor sigue cobrándose |

Los buckets Railway son privados; necesitan URLs firmadas o proxy. El adaptador actual genera URLs públicas de R2, por lo que no se puede prometer el segundo camino como integrado. La estimación anterior usa **volúmenes**, no buckets. Las cargas desde un servicio hacia un bucket también generan egress del servicio. [Entrega de archivos](https://docs.railway.com/guides/storage-buckets-guide) y [facturación de buckets](https://docs.railway.com/storage-buckets/billing).

Se preparó `MEDIA_DIR` y su ruta Docker para el primer camino. Antes de producción faltan montar el volumen, comprobar escritura con el usuario del contenedor, restauración y persistencia después de volver a desplegar. Las restricciones de capacidad y despliegue de los volúmenes deben comprobarse con el plan elegido. [Volúmenes](https://docs.railway.com/volumes/reference).

## Por qué R2 puede reducir el costo

R2 Standard incluye 10 GB-mes de almacenamiento, un millón de operaciones de escritura y diez millones de lectura mensuales; no cobra salida de datos. Con un catálogo pequeño puede quedar en USD 0, sujeto a esas cuotas. Los flyers deben servirse directamente desde su dominio público para evitar que todas sus descargas atraviesen Railway. [Tarifas R2](https://developers.cloudflare.com/r2/pricing/).

Ejemplo calculado para el volumen informado: 1,000 visitas que transfieran en promedio 10 MB de imágenes cada una representan aproximadamente 10 GB. Servirlas desde Railway supone unos USD 0.50 de egress. Si esas imágenes salen directamente de R2, se evita esa parte del tráfico de Railway; sigue existiendo la transferencia de HTML, JavaScript y API de la aplicación. Con 200 GB de imágenes el egress evitado sería unos USD 10. Son supuestos, no mediciones actuales.

## Cómo mantener el objetivo de USD 20

1. Empezar con una aplicación y una base, una réplica por servicio. Mantener staging local o encenderlo solo durante verificaciones cuando sea posible.
2. Usar la conexión privada entre aplicación y PostgreSQL, en el mismo proyecto/región. Evitar tránsito público innecesario de la base. [Interpretar la factura](https://docs.railway.com/pricing/understanding-your-bill).
3. Programar la tarea para que termine después de ejecutarse, sin mantener un tercer servidor HTTP encendido todo el mes. [Cron Railway](https://docs.railway.com/cron-jobs).
4. Medir 7–14 días: RAM media de app/base, CPU, GB de salida, tamaño de archivos y copias; extrapolar al mes y conservar margen para picos.
5. Configurar alertas de consumo, por ejemplo a USD 12 y/o 15 según lo que permita el panel. Un límite duro puede apagar la web cuando se alcance; no sirve como garantía de USD 20 con disponibilidad continua. [Controles de gasto](https://docs.railway.com/pricing/cost-control).
6. Si las métricas lo justifican, optimizar peso de flyers y consultas. El catálogo actual es dinámico y cada pestaña visible consulta cambios cada 30 segundos. Una futura caché debe invalidarse al editar y respetar el próximo retiro; no habilitar una caché larga que mantenga programas vencidos.

Los importes no incluyen impuestos, conversión de moneda, renovación del dominio, correo externo ni servicios adicionales. Tampoco incluyen desarrollo o mantenimiento. Revisar qué servicios cubren hoy los USD 20 antes de cancelar el hosting actual, especialmente si también presta correo.

Con Payload confirmado, **validar primero el panel localmente y medir la arquitectura de producción antes de contratar o dimensionar**. Para la implementación prevista en Railway, usar USD 7–12 como escenario condicionado a los recursos anteriores y USD 15 como presupuesto con margen, sin tratarlo como tope garantizado. Sustituir estas estimaciones por las métricas reales del despliegue.
