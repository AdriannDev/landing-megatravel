# Guía del equipo comercial

Si todavía no se creó la cuenta o el panel no está conectado, seguir [configuración y primer uso del CMS](cms.md). La recuperación de contraseña por correo está pendiente de integración; mientras tanto, solicitar a un administrador que cambie la contraseña desde Usuarios.

Entra en `/admin` con tu cuenta. El panel está en español. En Salidas encontrarás accesos a Publicados, Próximos a retirarse, Retirados y Borradores. Puedes buscar por programa o MTPE, filtrar, elegir columnas y usar la edición masiva de Payload para campos comunes. Cada cambio se valida y queda registrado.

## Crear una nueva salida a partir de un programa

1. Abre «Duplicar un programa y crear salidas» en el inicio o la lista de Salidas.
2. Selecciona una salida del programa como plantilla. Escribe fecha y precio. Usa «Añadir otra fecha» para generar varios registros independientes.
3. Pulsa «Crear borrador» y abre el enlace del nuevo registro.
4. Revisa las pestañas Información comercial, Salida y retiro, Flyer y enlaces y Publicación.
5. Sube el archivo del flyer desde tu ordenador o selecciónalo en Imágenes. Comprueba el flyer completo y la vista previa. Para contenido nuevo, la carga de archivo es el flujo principal.
6. Cambia el estado a Publicado y guarda. Si falta una imagen, el precio no es válido, los enlaces no usan HTTPS o la fecha ya venció, el panel muestra el dato que debes corregir.

La tarjeta se retira automáticamente 30 días antes de la salida. Puedes cambiar esa anticipación, por ejemplo a 15 días. El formulario muestra el corte calculado antes de publicar. La fecha de salida siempre se escribe como AAAA-MM-DD para evitar cambios por huso horario.

## Retirar y reactivar

Para retirar, abre la salida, cambia el estado a Retirado y elige el motivo. Si eliges Otro, explica la causa. Guarda el registro. Se conserva el responsable, la fecha y el cambio de estado en el historial.

Para reactivar, corrige precio, enlaces o fechas según corresponda; marca la confirmación de revisión y cambia a Publicado. Si ya pasó la fecha de retiro calculada, primero corrige la fecha de salida o la anticipación. El historial anterior permanece disponible.

## Flyers como archivos, migración y operaciones masivas

Se admiten archivos JPEG, PNG, WebP y GIF de hasta 12 MB. Subir un archivo genera automáticamente su dirección de publicación; no es necesario pegar un enlace externo. La conversión automática a un formato/peso menor está pendiente: por ahora, usar archivos ya optimizados y comprobar que el texto comercial siga legible.

El campo de enlace queda disponible para migrar imágenes existentes del Excel. Al guardar un enlace nuevo, el CMS intenta descargarlo automáticamente. Si falla, muestra el motivo y conserva el enlace para mostrar el flyer. «Copiar imágenes desde sus enlaces» permite reintentar hasta 50 pendientes por operación, conserva el original y reutiliza copias ya existentes. Repite la operación si quedan pendientes.

Para CSV, exporta primero el catálogo; conserva `source_key` al editar filas existentes. Valida el archivo sin importar, revisa errores y después importa las filas válidas. Las filas con error se reportan y no se escriben. Las columnas de estado, origen y claves deben conservar sus valores esperados. La importación no reactiva salidas retiradas: esa revisión se hace en el formulario.

## Promociones y banners

Crea promociones con nombre, etiqueta pública e identificador; el periodo es opcional si no hay una fecha definida. Asócialas a las salidas. Las promociones del mismo filtro se combinan con OR; distintos filtros se combinan con AND.

Cada banner tiene imagen de escritorio, alternativa estática y versión móvil opcional. Añade texto alternativo útil, orden, enlace si aplica y periodo de publicación. La alternativa estática se utiliza cuando el visitante solicita movimiento reducido. Si hay varios banners, el carrusel avanza solo al usar sus controles.
