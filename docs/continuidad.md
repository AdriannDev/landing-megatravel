# Estado y próximos pasos del desarrollo

Revisión del 24 de octubre de 2026. Este documento describe lo comprobado en el repositorio local; no acredita servicios ni despliegues en cuentas externas.

## Qué está implementado y qué se verificó

El catálogo y Payload CMS comparten una aplicación Next.js. El panel está en `/admin`, en español, con administradores y editores. Ya existen salidas, publicación/retiro/reactivación, historial, promociones, banners, importación/exportación CSV y herramientas para duplicar programas y crear fechas. No hace falta desarrollar otro panel ni contratar un servidor independiente para el CMS.

| Comprobación | Resultado de esta revisión | Límite |
| --- | --- | --- |
| `npm test` | 31 pruebas aprobadas | Dominio e importación; incluye conciliación con el Excel local |
| `npm run check:source` | Correcto | Sintaxis, no despliegue |
| `npm run check:domain` | Correcto | Tipos de las reglas independientes |
| `npm run typecheck` | Correcto después de corregir 13 errores | Tipos del proyecto |
| `npm run test:integration` | 14 comprobaciones aprobadas | Payload con SQLite y medios aislados en `.qa/`; no PostgreSQL ni R2 |
| `npm run build` | Completado en Node 24.22.1, sin advertencias de compilación | Build local en modo `workbook`; no se verificó el contenedor Linux |
| Inspección visual y prueba completa por navegador | Pendiente | Escritorio, móvil, teclado y recorrido del editor |
| Migración/restauración PostgreSQL y lanzamiento | Pendiente | Requieren los servicios correspondientes |

La instalación global de Node se actualizó de 24.19.0 a **24.22.1 LTS**, con npm **11.19.1**, el 24 de octubre. Se comprobó el instalador oficial con SHA256 y firma OpenJS Foundation; Windows exigió elevación de administrador y la instalación elevada terminó con código 0, sin reinicio. El proyecto ya tiene esa referencia en `.nvmrc` y `engines`.

Next.js **16.4.3** ya estaba instalado y se confirmó como última versión estable mediante npm y el release oficial. Es compatible con `@payloadcms/next@3.90.2`. La actualización que faltaba era la del motor Node. Ver [procedimiento y diferencia entre versiones](configuracion.md#actualizar-nodejs-y-comprobar-nextjs).

El sandbox de Windows bloqueó inicialmente `tsx` con `uv_os_get_passwd`; integración y build se ejecutan fuera del sandbox con autorización. Eso no es un requisito de Railway.

Tras la actualización de Node se repitieron las comprobaciones de la tabla: 31 pruebas, tipos completos y del dominio, sintaxis, 14 comprobaciones del CMS y build correctos. La integración sigue avisando de la falta del adaptador de correo, pendiente de configuración. El build anterior con Node 24.19.0 terminó con advertencias; el último, con 24.22.1, terminó sin advertencias de compilación.

No existe `.env.local` en esta revisión. No se encontraron Docker ni las herramientas PostgreSQL en el PATH de esta sesión. Existen dependencias instaladas y el repositorio se gestiona en `main` con el remoto `origin`. El estado de los commits se consulta con `git log` y `git status`; la publicación del código no acredita un despliegue.

## Orden de continuación

El usuario confirmó mantener **Payload como CMS**, con Next.js y PostgreSQL para producción en Railway. Las imágenes se suben como archivos desde el panel. Primero se configura el entorno local y después se valida el flujo comercial antes del despliegue. El [presupuesto](costos-railway.md) recoge el consumo estimado de esta arquitectura.

La [guía de pruebas locales](pruebas-locales.md) cubre SQLite para empezar y PostgreSQL/contenedor para validar la arquitectura de producción. La aceptación manual y PostgreSQL siguen pendientes; no se creó una cuenta de uso diario durante la documentación. La configuración del secreto propio, el administrador y el origen CMS se realiza siguiendo [la guía de Payload](cms.md).

| Prioridad | Pendiente | Cómo se da por terminado |
| --- | --- | --- |
| 0: aceptación | Validar localmente Payload con las tareas del equipo | Recorrido como administrador/editor y evaluación de formularios, imágenes, retiros y herramientas; documentar ajustes |
| 0: arquitectura pública | Definir caché/publicación estática según el presupuesto | Conservar permisos, actualización de precios y cortes de retiro; verificar costo total y funciones conservadas |
| 1: desarrollo local | Crear `.env.local`, secreto propio y primera cuenta | Bootstrap correcto y acceso real a `/admin`; seguir [CMS](cms.md) |
| 1: desarrollo local | Activar `CATALOG_SOURCE=cms` e importar datos | Editar/publicar/retirar una salida y comprobar el catálogo |
| 2: datos | Revisar errores de importación, flyers y diez borradores | Informe sin errores para los registros aceptados y enlaces comprobados |
| 2: base de producción | Disponer de PostgreSQL de desarrollo/staging | Conexión válida, separada de producción; Docker Compose es una opción |
| 2: esquema | Generar, revisar y aplicar la migración inicial | Archivos en `src/migrations/` versionados y arranque contra PostgreSQL vacío |
| 2: archivos | Elegir R2 o volumen persistente en Railway | Una carga sigue disponible después de reiniciar y volver a desplegar |
| 2: acceso | Incorporar y configurar correo transaccional | Recuperación de contraseña recibida y enlace válido |
| 3: aceptación | Probar interfaz, permisos, enlaces y retiros | Recorrido completo como administrador y editor, escritorio/móvil |
| 3: operación | Configurar tarea diaria y copias/restauración | Cron termina correctamente; restauración comprobada en otra base |
| 3: publicación | Configurar Railway, dominio, DNS y presupuesto | HTTPS, `/api/health` en modo CMS y estimación basada en métricas reales |

Para el correo falta implementar un adaptador en `src/payload.config.ts` y configurar un proveedor/remitente. Actualmente Payload informa que escribe el correo en consola. El inicio de sesión funciona, pero la recuperación por correo no debe darse por habilitada. No existen variables SMTP implementadas que baste con rellenar. [Correo en Payload](https://payloadcms.com/docs/email/overview).

La preparación del Excel contiene 411 registros: 233 con estado publicado, diez borradores y 168 retirados. Son recuentos del archivo preparado el 23 de octubre, no del catálogo visible hoy. La vigencia se comprueba con la fecha actual; una importación posterior puede rechazar publicaciones vencidas. Hay que revisar el informe y resolver esos casos conservando su procedencia.

## Cambios realizados el 24 de octubre

- Corregidos los tipos de validadores, relaciones del importador y plantilla de duplicación. La plantilla conserva una lista explícita de campos comerciales.
- La copia de flyers informa cuando una salida no tiene URL de origen.
- `bootstrap`, `import:cms` y `test:integration` aceptan variables del servicio sin exigir un archivo `.env.local`. Cuando el archivo existe, lo siguen cargando.
- Añadida `MEDIA_DIR` para fijar la carpeta de cargas locales. El Dockerfile establece `/app/media`, de modo que el servidor standalone y los scripts puedan compartir la misma ruta. El volumen real y sus permisos siguen pendientes de probar en Railway.
- Regenerado el mapa de componentes del panel mediante el build.
- Corregida la comprobación del responsable de retiro cuando Payload devuelve la relación poblada. Añadida una carga real de imagen a la prueba aislada y evitada la descarga remota de su flyer de ejemplo.
- Añadidas las guías de [configuración y uso del CMS](cms.md) y [presupuesto Railway](costos-railway.md).
- Actualizado Node global a 24.22.1 LTS y npm a 11.19.1. Next 16.4.3 se verificó como versión estable vigente y compatible con Payload.
- Actualizado el presupuesto con las 1,000 personas mensuales informadas por el usuario: ejemplos de tráfico de USD 0.15–1.00, consumo permanente de app/base y alternativas de caché o catálogo estático. Son estimaciones condicionadas al consumo real de memoria; esas alternativas de arquitectura siguen pendientes de implementación.
- Registrada la preferencia por optimizar la entrega pública del catálogo. La estimación de Railway queda limitada a la arquitectura actual y debe sustituirse por mediciones del despliegue.
- Documentada la carga normal de archivos como flujo principal de imágenes. Ya existe en Payload; la compresión automática y las versiones de imagen están pendientes. Los enlaces se mantienen documentados para migración y procedencia.
- Confirmado Payload como CMS para el alcance comercial actual y la prueba del panel con usuarios no técnicos. La documentación se unificó alrededor de esta elección, eliminando evaluaciones de otros CMS y alojamientos.
- Añadida la guía de aceptación local con SQLite, PostgreSQL, archivos, tarea de retiro y límites de las pruebas frente a los servicios del proveedor.

No se crearon cuentas comerciales, no se importó contenido en una base de operación y no se contrataron ni desplegaron servicios.

## Documentar cada entrega

Una parte del desarrollo se considera terminada cuando incluye código, comprobaciones pertinentes y documentación del comportamiento resultante. Actualizar la guía afectada, las nuevas variables/comandos, los cambios de esquema y este estado cuando cambien los pendientes. Registrar fecha, resultado de validación y limitaciones; conservar los reportes anteriores como históricos. El procedimiento está en [mantenimiento](mantenimiento.md#documentación-de-cada-cambio).
