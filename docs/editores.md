# Guía del equipo comercial

Si todavía no se creó la cuenta o el panel no está conectado, seguir [configuración y primer uso del CMS](cms.md). La recuperación de contraseña por correo está pendiente de integración; mientras tanto, solicitar a un administrador que cambie la contraseña desde Usuarios.

Entra en `/admin` con tu cuenta: abre directamente la tabla de Salidas, ordenada por la fecha más próxima. La vista inicial **Publicadas** incluye solo salidas vigentes. **Próximas a retirarse** muestra el corte dentro de siete días; **Retiradas** también incluye las vencidas pendientes del cron. **Borradores** permanece separada. La URL conserva la vista al buscar o paginar. Puedes buscar por programa o MTPE, elegir columnas y usar la edición masiva de Payload para condiciones de las salidas.

## Crear una nueva salida a partir de un programa

1. Pulsa **Nueva salida**. Selecciona un programa existente o completa uno nuevo: MTPE, nombre, destino, zona, duración, naviera opcional, flyer y enlaces de Meganet y Café.
2. Indica origen, moneda y condiciones. Usa «Añadir otra fecha» para introducir entre 1 y 30 filas de fecha/precio.
3. Pulsa «Crear borradores». El programa y sus fechas se guardan juntos; si una fecha falla, no quedan salidas parciales. Se rechaza un MTPE/origen/fecha repetido, incluso si la salida anterior está retirada.
4. Abre los enlaces para revisar cada borrador, ajustar promociones, precio, prioridad o anticipación, y ver su vista previa privada.
5. Cambia el estado a Publicado y guarda. Se validan el precio, la moneda, los enlaces HTTPS y la vigencia. El flyer es opcional: sin él aparece una imagen de Megatravel.

**Programas** guarda el contenido común una sola vez por MTPE. Edita allí nombre, destino, zona, duración, naviera, flyer y enlaces. El cambio aparece en todas sus fechas, incluidas las ya publicadas; las pestañas públicas abiertas se actualizan en hasta 30 segundos. El MTPE identifica el programa y no se cambia después de crearlo. El precio, moneda, condición, origen, promociones, prioridad, fecha, anticipación y estado se editan por salida.

La imagen predeterminada no rellena el campo de flyer: los programas pendientes de arte siguen siendo identificables. Sube el flyer al programa para sustituirla en todas sus fechas. Si una imagen falla al cargar, también se usa el respaldo de Megatravel. La herramienta secundaria «Duplicar un programa y crear salidas» reutiliza el programa compartido.

La tarjeta se retira automáticamente 30 días antes de la salida. Puedes cambiar esa anticipación, por ejemplo a 15 días. El formulario muestra el corte calculado antes de publicar. La fecha de salida siempre se escribe como AAAA-MM-DD para evitar cambios por huso horario.

## Cupos referenciales y últimos cupos

En cada salida, abre **Información comercial → Cupos referenciales**. Puedes introducir las sillas disponibles y activar **Destacar como «Últimos cupos»**, incluso sin una cantidad exacta. Estos datos pertenecen únicamente a esa fecha y origen. En «Nueva salida» también puedes completarlos por fila.

La card muestra «Cupos referenciales: 10 sillas» y «Disponibilidad sujeta a cambios. Confirma en Meganet o con un asesor». Ambas opciones tienen enlace: Meganet utiliza el enlace del programa y el asesor utiliza el contacto comercial de Configuración. «Últimos cupos» aparece como una franja naranja bajo el flyer, con icono de llama y la cantidad referencial si está informada; esa cantidad no se repite en el cuerpo de la card. La etiqueta es manual y no cambia el orden de las cards. La promoción «Año Nuevo» utiliza una etiqueta dorada con forma de boleto; debe asociarse a la salida como cualquier otra promoción.

Cambiar la cantidad o la etiqueta registra la revisión automáticamente al guardar. Si los cupos siguen iguales, verifica en Meganet o con un asesor, marca **Confirmo que estos cupos siguen vigentes** y guarda. El panel registra la fecha de revisión y vuelve a desmarcar la casilla. Editar precios, flyers, el programa compartido o importar un CSV no renueva esa fecha.

La vigencia predeterminada es de **72 horas**. Un administrador puede ajustarla entre 1 y 720 horas en **Configuración del catálogo**. Al vencer se ocultan la cifra y «Últimos cupos», y la card invita a consultar en Meganet o con un asesor. La salida y los valores guardados permanecen disponibles. La vista **Cupos por revisar** reúne referencias vencidas de salidas publicadas y vigentes; la columna «Última revisión de cupos» indica Vigente, Por revisar o Sin informar.

Vacío significa sin cantidad informada; cero desactiva la urgencia y muestra la invitación a consultar. Si confirmas que está agotada, retírala con el motivo **Sin stock**. Duplicar para otras fechas comienza sin cupos; cambiar fecha, origen o programa de una salida invalida su referencia anterior. Los CSV conservan su formato actual y no editan cupos.

## Retirar y reactivar

Para retirar, abre la salida, cambia el estado a Retirado y elige el motivo. Si eliges Otro, explica la causa. Guarda el registro. Se conserva el responsable, la fecha y el cambio de estado en el historial.

Para reactivar, corrige precio, enlaces o fechas según corresponda; marca la confirmación de revisión y cambia a Publicado. Si ya pasó la fecha de retiro calculada, primero corrige la fecha de salida o la anticipación. El historial anterior permanece disponible.

## Flyers como archivos, migración y operaciones masivas

Se admiten archivos JPEG, PNG, WebP y GIF de hasta 12 MB. Subir un archivo genera automáticamente su dirección de publicación; no es necesario pegar un enlace externo. La conversión automática a un formato/peso menor está pendiente: por ahora, usar archivos ya optimizados y comprobar que el texto comercial siga legible.

El campo de enlace queda disponible para migrar imágenes existentes del Excel. Al guardar un enlace nuevo, el CMS intenta descargarlo automáticamente. Si falla, muestra el motivo y conserva el enlace para mostrar el flyer. «Copiar imágenes desde sus enlaces» permite reintentar hasta 50 pendientes por operación, conserva el original y reutiliza copias ya existentes. Repite la operación si quedan pendientes.

Para CSV, exporta primero el catálogo; conserva `source_key` al editar filas existentes. Las columnas y claves se mantienen. Todas las filas de un MTPE deben coincidir en sus datos compartidos; una contradicción rechaza ese grupo completo. La importación guarda cada grupo de MTPE en una transacción y reporta los fallos por fila. No reactiva salidas retiradas: esa revisión se hace en el formulario.

## Promociones y banners

Crea promociones con nombre, etiqueta pública e identificador; el periodo es opcional si no hay una fecha definida. Asócialas a las salidas. Las promociones del mismo filtro se combinan con OR; distintos filtros se combinan con AND.

Cada banner tiene imagen de escritorio, alternativa estática y versión móvil opcional. Recomendamos **1600 × 600 px** para escritorio y una versión **800 × 800 px** para móvil. Se muestra el arte completo, sin recortarlo. Añade texto alternativo, ubicación, orden, enlace y periodo; marca Publicado para habilitarlo.

Las ubicaciones son **Hero**, a todo el ancho del contenido bajo la presentación; **Entre resultados**, después de las primeras seis tarjetas si hay más; y **Final del catálogo**, antes del contacto. Un espacio sin banners vigentes no deja huecos. Los banners anteriores pertenecen al hero.

El hero avanza cada seis segundos y ofrece flechas, indicadores y pausa. El arte ocupa todo el carrusel: las flechas se superponen a ambos extremos y la pausa queda en la esquina inferior derecha, con controles semitransparentes. Se pausa al interactuar, al ocultar la pestaña y ante movimiento reducido; la alternativa estática evita animaciones. La reproducción se puede reanudar desde su botón cuando la preferencia lo permite. Las otras ubicaciones se navegan manualmente. En el catálogo, los grupos de filtros empiezan cerrados y Desde/Hasta permanece visible; abrir un grupo no cambia la selección.

## Popup de promociones o noticias

En **Contenido → Banners → Crear**, selecciona **Popup (ventana emergente)**. Completa el título y el texto; para una promoción puedes añadir una imagen (recomendado **1200 × 900 px**, sin recorte) y su alternativa estática. La noticia puede publicarse sin imagen. El texto alternativo identifica el anuncio en el panel y describe la imagen.

Elige Promoción o Noticia, añade un enlace HTTPS y el texto del botón si lo necesitas. Configura la espera (por defecto, dos segundos), la frecuencia (una vez por sesión, cada 24 horas o cada visita), la vigencia y **Publicado**. Si coinciden varios popups, aparece únicamente el de menor orden. Se cierra con la X, Escape, un clic fuera o «Seguir explorando».

En escritorio, la imagen aparece a la izquierda y el contenido a la derecha; en móvil, la imagen queda arriba. Las promociones con fecha de fin muestran una cuenta regresiva hasta esa fecha y se cierran al vencer. Las noticias y las promociones sin fecha de fin se muestran sin contador.

La frecuencia se cuenta desde que se muestra el anuncio en ese navegador. Una nueva fecha «Visible desde» inicia otra campaña. Si el navegador bloquea el almacenamiento, se muestra una vez mientras el catálogo permanece abierto. El popup espera si hay otra ventana del catálogo abierta o la pestaña está oculta.
