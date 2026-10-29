# Plan: cupos referenciales por salida

Estado: implementado en código el 29 de octubre de 2026. Vigencia inicial: 72 horas, configurable entre 1 y 720. Confirmación pública mediante dos enlaces: Meganet o un asesor. Esta especificación conserva el planteamiento aprobado; la operación actual está documentada en [la guía del equipo](editores.md#cupos-referenciales-y-últimos-cupos). El despliegue PostgreSQL requiere aplicar su migración y verificar staging.

## Objetivo

Mostrar una referencia de sillas disponibles en cada card y permitir destacar las salidas con pocos cupos. La información debe ayudar a preparar la venta sin presentarse como inventario en tiempo real ni exigir actualizar permanentemente todas las fechas.

## Encaje con el proyecto actual

El catálogo ya tiene una card por salida. Las salidas se diferencian por programa, origen y fecha; el contenido compartido se edita en Programas. Los cupos pertenecerán a Salidas, junto con sus condiciones comerciales. Dos fechas del mismo programa podrán mostrar cantidades y etiquetas diferentes.

La reserva seguirá dirigiendo a Meganet. La landing no descontará sillas por clics ni simulará disponibilidad en tiempo real. Las salidas actuales podrán seguir publicadas sin completar estos datos.

## Propuesta recomendada

### Campos en el administrador

Agregar una sección «Cupos referenciales» en la información comercial de cada salida:

| Campo | Uso |
| --- | --- |
| Sillas disponibles, referenciales | Número entero opcional, mayor o igual que cero. Vacío significa que no se informa una cantidad; nunca se interpreta como cero. |
| Destacar como «Últimos cupos» | Casilla manual, desactivada por defecto. Puede usarse sin informar una cantidad exacta. |
| Última revisión de cupos | Fecha y hora calculadas por el servidor, de solo lectura. Se muestran al equipo en horario de Lima. |
| Confirmar vigencia de los cupos | Acción explícita para confirmar que la referencia sigue vigente aunque la cantidad no haya cambiado. |

Cambiar la cantidad o la casilla registra una nueva revisión. Confirmar la vigencia también la registra. Guardar un cambio de precio, editar el programa compartido o importar otros datos no renueva la revisión de cupos.

Si se introducen cero sillas, se desactiva la etiqueta de últimos cupos. Para una salida confirmada como agotada se mantiene el retiro existente con motivo «Sin stock»; el valor referencial cero no retira automáticamente una publicación.

### Cómo se verá la card

- Cantidad junto a los datos de salida, antes del precio: **Cupos referenciales: 10 sillas**. Usar «1 silla» en singular.
- Aclaración visible junto a la referencia: **Disponibilidad sujeta a cambios. Confirma en Meganet o con un asesor.** Ambas opciones tienen enlace.
- Etiqueta **¡Últimos cupos!** como franja naranja inmediatamente debajo del flyer, con icono de llama y la cantidad referencial, según la referencia visual posterior del usuario. Visible sin pasar el cursor, sin cubrir el flyer ni usar parpadeos. La cifra se muestra una sola vez en cada card.
- Conservar las etiquetas de promociones y el botón «Reservar en Meganet»; la disponibilidad tendrá su propia presentación.
- Mostrar el estado resultante en las vistas previas del administrador y de la salida.

| Situación, mientras la revisión esté vigente | Presentación |
| --- | --- |
| 10 sillas y etiqueta desactivada | «Cupos referenciales: 10 sillas» y aclaración. |
| 3 sillas y etiqueta activada | «¡Últimos cupos!», «Cupos referenciales: 3 sillas» y aclaración. |
| Cantidad vacía y etiqueta activada | «¡Últimos cupos!» y aclaración, sin inventar una cifra. |
| Cantidad vacía y etiqueta desactivada | «Consulta disponibilidad en Meganet o con un asesor». |
| Cero sillas | «Consulta disponibilidad en Meganet o con un asesor», sin etiqueta de urgencia. |
| Revisión vencida o sin fecha válida | «Consulta disponibilidad en Meganet o con un asesor», sin cantidad ni etiqueta de urgencia. |

### Vigencia para reducir mantenimiento

Propuesta inicial, pendiente de evaluación: **72 horas desde la última revisión**, como configuración general editable por un administrador.

Al vencer ese plazo se ocultan públicamente la cantidad y la etiqueta. La card conserva el programa, precio, fecha y acceso a Meganet. Los valores se conservan en el CMS para que el equipo pueda revisarlos y confirmarlos de nuevo.

El vencimiento se aplicará tanto al entregar los datos públicos como en una pestaña que permanezca abierta. No dependerá únicamente de una tarea programada. Se aprovechará el refresco existente del catálogo para recoger cambios, manteniendo la fecha de vencimiento para ocultar referencias caducadas en pantalla.

En el listado administrativo se podrá identificar «Sin informar», «Vigente» y «Por revisar», con un filtro «Cupos por revisar». No habrá correos ni notificaciones adicionales en esta primera versión.

### Control manual de la urgencia

Se recomienda activar «Últimos cupos» manualmente en esta primera versión. La cantidad es una estimación que puede quedar desactualizada y el equipo puede conocer una situación de escasez sin manejar una cifra exacta.

Una regla automática, por ejemplo «cinco sillas o menos», puede evaluarse posteriormente. No se incluye como comportamiento inicial ni se ordenarán las cards automáticamente por cupos.

## Implementación propuesta

1. **Datos y CMS.** Añadir los campos opcionales en Salidas y el plazo general de vigencia en Configuración. Validar enteros no negativos, impedir que el cliente elija arbitrariamente la fecha de revisión y registrar las actualizaciones mediante el historial existente. Preparar la migración PostgreSQL, incluyendo versiones, y regenerar los tipos de Payload. Los registros anteriores comenzarán sin referencia ni etiqueta.
2. **Flujos de trabajo.** Permitir completar cupos por cada fila del formulario de nuevas fechas. Al duplicar una salida para otra fecha, comenzar sin cantidad, sin etiqueta y sin revisión; no copiar su disponibilidad. Cambiar la fecha o el origen de una salida también invalida la revisión anterior. Los CSV actuales seguirán funcionando y sus importaciones no borrarán ni renovarán los cupos existentes. La edición de cupos mediante CSV queda fuera de la primera versión.
3. **Publicación de datos.** Extender los tipos, la normalización y la lista explícita de campos públicos. Aplicar una regla compartida de vigencia y presentación en la API, las cards y las vistas previas. No publicar el usuario responsable ni otros datos internos de auditoría.
4. **Interfaz.** Añadir la referencia, su aclaración y la etiqueta, cuidando el contraste, la lectura en móvil y la convivencia con promociones. Añadir los controles y el filtro administrativo para localizar referencias pendientes de revisión.
5. **Validación y documentación.** Actualizar la guía de editores. Verificar la migración en PostgreSQL de pruebas y los recorridos de crear, editar, confirmar, duplicar y retirar antes de desplegar.

Archivos principales implicados: `src/collections/content.ts`, `src/lib/types.ts`, `src/lib/catalog.ts`, `src/server/normalize.ts`, `src/server/hooks.ts`, `src/server/departure-service.ts`, los formularios y vistas previas administrativos, `src/components/package-card.tsx`, los estilos del catálogo y las migraciones. Se revisará también la exportación CSV para mantener su contrato actual.

## Criterios de aceptación

- Dos fechas u orígenes del mismo programa conservan sus cupos de forma independiente.
- Publicar sin indicar cupos sigue siendo válido.
- Vacío, cero y un número positivo tienen comportamientos distintos; negativos y decimales se rechazan.
- La aclaración se muestra al presentar una cantidad o una etiqueta de escasez.
- La urgencia puede activarse sin una cifra, pero nunca junto a cero sillas.
- Al vencer la revisión se ocultan cantidad y urgencia, incluso en una pestaña abierta; la salida sigue visible.
- Confirmar una referencia sin modificar su valor renueva su vigencia; editar otro dato no lo hace.
- Duplicar para otra fecha no copia disponibilidad. Cambiar la fecha o el origen invalida la referencia anterior.
- Importar un CSV anterior o editar el programa compartido no modifica la disponibilidad de sus salidas.
- El flujo existente de retiro por «Sin stock» mantiene su funcionamiento.
- Las cards y sus vistas previas coinciden en los estados mostrados, también en móvil y con varias promociones.

## Decisiones para evaluar

1. **Texto:** se propone «Cupos referenciales: 10 sillas» y «¡Últimos cupos!».
2. **Vigencia:** se proponen 72 horas, ajustables para todo el catálogo según el ritmo real de revisión del equipo.
3. **Urgencia:** se propone activación manual, independiente de la cifra.

La recomendación es implementar primero esta versión y observar si el equipo utiliza más la cantidad o la etiqueta. Eso permitirá decidir después si conviene conectar una fuente de inventario o añadir reglas automáticas.
