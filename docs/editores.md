# Guía del equipo comercial

Si todavía no se creó la cuenta o el panel no está conectado, seguir [configuración y primer uso del CMS](cms.md). La recuperación de contraseña por correo está pendiente de integración; mientras tanto, solicitar a un administrador que cambie la contraseña desde Usuarios.

Entra en `/admin` con tu cuenta: abre directamente la tabla de Salidas, ordenada por la fecha más próxima. La vista inicial **Publicadas** incluye solo salidas vigentes. **Próximas a retirarse** muestra el corte dentro de siete días; **Retiradas** también incluye las vencidas pendientes del cron. **Borradores** permanece separada. La URL conserva la vista al buscar o paginar. Puedes buscar por programa o MTPE, elegir columnas y usar la edición masiva de Payload para condiciones de las salidas.

## Crear una nueva salida a partir de un programa

1. Pulsa **Nueva salida**. Selecciona un programa existente o completa uno nuevo: MTPE, nombre, destino, zona, duración, naviera opcional, imagen y enlaces de Meganet y Café. Para la imagen puedes elegir una ya cargada en la biblioteca, subir un archivo, usar un enlace HTTPS o dejar la predeterminada.
2. Indica origen, moneda y condiciones. Usa «Añadir otra fecha» para introducir entre 1 y 30 filas de fecha/precio.
3. Elige **Guardar como borrador** o **Publicar salidas**. También puedes usar **Nueva fecha** para partir de una salida existente y elegir entre crear borradores o publicar directamente. El programa y sus fechas se guardan juntos; si una fecha falla, no quedan salidas parciales. Se rechaza un MTPE/origen/fecha repetido, incluso si la salida anterior está retirada.
4. Al publicar se validan precio, moneda, enlaces HTTPS y vigencia. Si guardaste borradores, ábrelos para revisarlos y publicarlos más adelante. La imagen es opcional: sin ella aparece un fondo gris con el tamaño recomendado.

**Programas** guarda el contenido común una sola vez por MTPE. Edita allí nombre, destino, zona, duración, naviera, flyer y enlaces. El cambio aparece en todas sus fechas, incluidas las ya publicadas; las pestañas públicas abiertas se actualizan en hasta 30 segundos. Una salida puede tener un destino o enlace de reserva propio: esos valores prevalecen sobre los del programa para esa fecha. El MTPE identifica el programa y no se cambia después de crearlo. El precio, moneda, condición, origen, promociones, prioridad, fecha, anticipación y estado se editan por salida.

La imagen predeterminada no rellena el campo de flyer: muestra un fondo gris con el tamaño recomendado, **800 × 800 px**. Sube el flyer al programa para sustituirla en todas sus fechas. Si una imagen falla al cargar, también se usa este respaldo. La herramienta secundaria «Duplicar un programa y crear salidas» reutiliza el programa compartido.

Para añadir un video, abre **Programas**, selecciona el programa y pega un enlace HTTPS de YouTube o de un reel en **Enlace del video del programa**. El botón de reproducción aparecerá en las tarjetas de todas sus salidas y abrirá el video en otra pestaña. Puedes reemplazar el enlace por otro video o borrarlo para ocultar el botón; hay un enlace activo por programa. En la vista de lista compacta aparece como «Ver video».

La tarjeta se retira automáticamente 30 días antes de la salida. Puedes cambiar esa anticipación, por ejemplo a 15 días. El formulario muestra el corte calculado antes de publicar. La fecha de salida siempre se escribe como AAAA-MM-DD para evitar cambios por huso horario.

## Cupos referenciales y últimos cupos

En **Salidas → Cupos de esta salida**, introduce la disponibilidad actual de esa fecha y origen y activa «Últimos cupos» si corresponde. El programa guarda valores iniciales para nuevas salidas. Cada fecha conserva cantidad, etiqueta y revisión propias. Consulta [la guía de carga y asignación masiva](cupos-por-salida.md).

La card muestra «Cupos referenciales: 10 sillas» y «Disponibilidad sujeta a cambios. Confirma en Meganet o con un asesor». Ambas opciones tienen enlace: Meganet utiliza el enlace del programa y el asesor utiliza el contacto comercial de Configuración. «Últimos cupos» aparece como una franja naranja bajo el flyer, con icono de llama y la cantidad referencial si está informada; esa cantidad no se repite en el cuerpo de la card. La etiqueta es manual y no cambia el orden de las cards. La promoción «Año Nuevo» utiliza una etiqueta dorada con forma de boleto; debe asociarse a la salida como cualquier otra promoción.

Cambiar la cantidad o la etiqueta registra la revisión automáticamente al guardar. Si los cupos siguen iguales, verifica en Meganet o con un asesor, marca **Confirmo que estos cupos siguen vigentes** y guarda. El panel registra la fecha de revisión y vuelve a desmarcar la casilla. Editar precios, flyers, el programa compartido o importar un CSV no renueva esa fecha.

La vigencia predeterminada es de **72 horas**. Un administrador puede ajustarla entre 1 y 720 horas en **Configuración del catálogo**. Al vencer se ocultan la cifra y «Últimos cupos», y la card invita a consultar en Meganet o con un asesor. La salida y los valores guardados permanecen disponibles. La vista **Cupos por revisar** reúne referencias vencidas de salidas publicadas y vigentes; la columna «Última revisión de cupos» indica Vigente, Por revisar o Sin informar.

Vacío significa sin cantidad informada; cero desactiva la urgencia y muestra la invitación a consultar. Si confirmas que está agotada, retírala con el motivo **Sin stock**. Una nueva fecha usa los valores iniciales del programa y permite alternativas por fila; no copia saldos reducidos. CSV admite `available_seats` y `last_seats`, con validación, confirmación y revalidación si cambia un saldo. Columnas ausentes o vacías conservan valores y revisión.

## Retirar y reactivar

Para retirar, abre la salida, cambia el estado a Retirado y elige el motivo. Si eliges Otro, explica la causa. Guarda el registro. Se conserva el responsable, la fecha y el cambio de estado en el historial.

Para reactivar, corrige precio, enlaces o fechas según corresponda; marca la confirmación de revisión y cambia a Publicado. Si ya pasó la fecha de retiro calculada, primero corrige la fecha de salida o la anticipación. El historial anterior permanece disponible.

## Flyers como archivos, migración y operaciones masivas

Se admiten archivos JPEG, PNG, WebP y GIF de hasta 12 MB. Las imágenes estáticas nuevas se optimizan automáticamente al subir: se intenta generar WebP sin recortar ni ampliar, con lado máximo de 1.600 px. El ahorro final depende de la imagen. Los GIF y WebP animados mantienen la animación. Revisa siempre la legibilidad del texto comercial; las imágenes ya guardadas no se modifican automáticamente.

El campo de enlace queda disponible para migrar imágenes existentes del Excel. Al guardar un enlace nuevo, el CMS intenta descargarlo automáticamente. Si falla, muestra el motivo y conserva el enlace para mostrar el flyer. «Copiar imágenes desde sus enlaces» permite reintentar hasta 50 pendientes por operación, conserva el original y reutiliza copias ya existentes. Repite la operación si quedan pendientes.

Para CSV, exporta primero el catálogo; conserva `source_key` al editar filas existentes. Las columnas y claves se mantienen. Las filas de un MTPE deben coincidir en sus datos compartidos; el destino y el enlace de reserva pueden variar por fecha. Una contradicción en los demás datos compartidos rechaza ese grupo completo. La importación guarda cada grupo de MTPE en una transacción y reporta los fallos por fila. No reactiva salidas retiradas: esa revisión se hace en el formulario.

## Orden del catálogo

**Destacados** ordena las salidas por su prioridad comercial; los empates se resuelven por fecha y por identificador. Los filtros se aplican antes de paginar, con doce salidas por página. Las tarjetas tienen el mismo tamaño. Los órdenes por fecha, precio y duración y las vistas de lista y tarjetas siguen disponibles.

## Promociones y banners

Crea promociones con nombre, etiqueta pública e identificador; el periodo es opcional si no hay una fecha definida. Asócialas a las salidas. Las promociones del mismo filtro se combinan con OR; distintos filtros se combinan con AND.

La promoción **Flash Sale** activa un degradado basado en el naranja **#ff7420**, con un acabado amarillo cálido y una sombra del mismo naranja más visible, sin borde exterior. Los textos e iconos usan blanco, con «Ver descriptivo» en #051d2e y la pastilla de días/noches en azul #0049fc. El botón de reserva usa el azul de la página con texto blanco. Las imágenes rellenan el marco cuadrado sin franjas ni línea inferior; las proporciones distintas pueden recortarse visualmente en los bordes, sin modificar el archivo original. Se reconoce por su nombre, etiqueta o identificador (`flash-sale`, `flash_sale` o `flashsale`), sin distinguir mayúsculas. El estilo aparece en tarjetas, lista y vista previa del panel; al quitar la promoción, la salida recupera su diseño habitual. El origen con el avión se muestra a la izquierda y el destino con la ubicación a la derecha.

Cada banner tiene imagen de escritorio, alternativa estática y versión móvil opcional. Para el hero recomendamos **1600 × 300 px** en escritorio y **800 × 800 px** en móvil. El rompetráfico usa **1200 × 70 px** en escritorio y **800 × 160 px** en móvil: ambos se muestran completos, con altura proporcional al ancho disponible. Diseña la versión móvil con menos texto y letras mayores; reutilizar la imagen horizontal de escritorio puede dejarla muy pequeña. El banner rectangular de la grilla conserva la imagen de escritorio y su proporción **900 × 640 px** también en móvil; el banner del contador mantiene el formato cuadrado y admite una imagen móvil de **800 × 800 px**. Los placeholders son fondos grises con sus dimensiones centradas. Añade texto alternativo, ubicación, orden, enlace y periodo; marca Publicado para habilitarlo.

Las ubicaciones son **Hero**, a todo el ancho del contenido bajo la presentación; **Entre resultados**, después de las primeras seis tarjetas de cada página; y **Inicio de la grilla**, encima de «Ordenar por» y del selector de lista o tarjetas, con separación respecto a los controles. Hasta **760 px**, Hero y Entre resultados muestran solo los banners con imagen móvil asignada. Si ninguno tiene, desaparece también su contenedor, sin huecos. Desde 761 px se muestran todos. El carrusel adapta su lista y controles al cambiar de ancho.

El hero y el rompetráfico avanzan cada seis segundos. El hero ofrece flechas y pausa, sin paginación. El arte ocupa todo el carrusel: las flechas se superponen a ambos extremos y la pausa queda en la esquina inferior derecha, con controles semitransparentes. Se pausa al interactuar con el hero, al ocultar la pestaña y ante movimiento reducido; la alternativa estática evita animaciones. La reproducción se puede reanudar desde su botón cuando la preferencia lo permite. En el catálogo, los grupos de filtros empiezan cerrados y Desde/Hasta permanece visible; abrir un grupo no cambia la selección.

Los beneficios sobre el hero avanzan cada cuatro segundos solo en móvil. Se pueden deslizar manualmente y pausar o reanudar con su botón; al interactuar con la fila se detienen. El avance se suspende fuera de pantalla, en pestañas ocultas y con movimiento reducido. Desde/Hasta abre el calendario nativo al pulsar el campo. Para regenerar los fondos grises sin tocar el CMS: `npm run seed:banner-placeholders -- --assets-only`; sin ese argumento, también se actualizan los medios y banners de ejemplo asociados.

## Actualizar Mega Blog

En **Administración → Configuración del catálogo → Mega Blog**, pulsa **Actualizar ahora** para buscar los seis artículos e imágenes más recientes sin esperar a la sincronización automática de cinco días. Guarda antes cualquier cambio pendiente del formulario. El botón muestra el progreso y actualiza las cards y la fecha al terminar; si falla, conserva los artículos anteriores y permite reintentar. Esta opción está disponible para administradores.

## Popup de promociones o noticias

En **Contenido → Banners → Crear**, selecciona **Popup (ventana emergente)**. Completa el título y el texto; para una promoción puedes añadir una imagen (recomendado **1200 × 900 px**, sin recorte) y su alternativa estática. La noticia puede publicarse sin imagen. El texto alternativo identifica el anuncio en el panel y describe la imagen.

Elige Promoción o Noticia, añade un enlace HTTPS y el texto del botón si lo necesitas. Configura la espera (por defecto, dos segundos), la frecuencia (una vez por sesión, cada 24 horas o cada visita), la vigencia y **Publicado**. Si coinciden varios popups, aparece únicamente el de menor orden. Se cierra con la X, Escape, un clic fuera o «Seguir explorando».

En escritorio, la imagen ocupa toda la zona izquierda y el contenido queda a la derecha; en móvil, la imagen queda arriba. En **Solo imagen**, el tamaño depende de la proporción de la imagen y del espacio de pantalla, sin franjas añadidas. La vista previa usa el mismo criterio. El cierre y los botones siguen accesibles. Las promociones con fecha de fin muestran una cuenta regresiva y se cierran al vencer; las noticias y promociones sin fecha de fin no muestran contador.

La frecuencia se cuenta desde que se muestra el anuncio en ese navegador. Una nueva fecha «Visible desde» inicia otra campaña. Si el navegador bloquea el almacenamiento, se muestra una vez mientras el catálogo permanece abierto. El popup espera si hay otra ventana del catálogo abierta o la pestaña está oculta.

## Eliminación y piloto de correo

Un administrador puede eliminar salidas publicadas, retiradas o en borrador desde la fila, ficha o selección múltiple. Los editores no pueden eliminarlas. La selección múltiple permite hasta 200 registros de la página y muestra las cantidades antes de confirmar.

En Programas, «Eliminar programa» muestra cuántos programas y salidas se eliminarán. La eliminación guarda una copia comercial en el historial y es irreversible. Imágenes, destinos, orígenes y otras referencias reutilizables permanecen. Si falla una parte, se revierte la selección completa. Si alguien edita la selección durante la confirmación, es necesario consultar de nuevo el resumen.

El retiro conserva el motivo obligatorio; «Otro» requiere explicación. El diálogo se puede cerrar con Escape y devuelve el foco al botón de opciones.

**Administración → Correos observados**, solo para administradores, muestra asunto, remitente, fecha, MTPE, localizador, cantidad, estado y motivo. **Movimiento bloqueado** significa que no se modificaron cupos. **Advertencia: movimiento aplicado** identifica un descuento activo sin localizador, procesado por mensaje. El cuerpo completo se consulta en el buzón. Las herramientas manuales del piloto fueron retiradas y las colecciones técnicas están ocultas. Los movimientos reales aparecen en el historial de cada salida. Fecha de viaje y origen también se muestran en los observados. [Reglas y operación de Gmail](gmail-cupos-piloto.md).
