# Cupos independientes por salida

Cada combinación **programa + fecha + origen** conserva cantidad, etiqueta manual y revisión. Si junio tiene 15 y julio tiene 15, reservar tres para junio deja junio en 12 y julio en 15. Dos orígenes del mismo día también tienen saldos separados.

**Programas → Valores iniciales de cupos** determina los valores de nuevas salidas. Cambiarlos no modifica salidas existentes. Nueva salida y Nueva fecha permiten cantidad, origen y etiqueta por fila. Duplicar usa los valores iniciales, sin copiar saldos reducidos por reservas.

## Carga y ajustes

La cantidad es la **disponibilidad actual**, con las ventas anteriores ya consideradas. Cero es explícito; vacío significa «Sin informar». La columna **Cupos disponibles** aparece junto a fecha y origen; **Última revisión de cupos** se conserva por separado.

Cambiar la cantidad o marcar **Confirmo la disponibilidad actual de esta salida** registra revisión y conciliación. Los avisos anteriores o iguales al instante de conciliación se observan sin descontar ventas ya incluidas. Cantidad e instante conciliados son privados. Editar contenido comercial no renueva la revisión.

Para varias salidas, selecciónalas en la tabla y abre **Asignar cupos a la selección**. Desde un programa, usa **Asignar cupos a las salidas del programa**. Puedes aplicar cantidad, etiqueta o ambas. La vista previa muestra fecha, origen y cantidades anterior/nueva. Confirma después de revisarla. Si interviene otro cambio, genera otra vista previa. La asignación conserva reservas conocidas y queda auditada. Cambiar solo la etiqueta renueva revisión sin cambiar la conciliación de la cantidad.

La vigencia es configurable: 72 horas por defecto, entre 1 y 720 horas. Catálogo, cards y vista previa usan exclusivamente valores de la salida. La etiqueta es manual; con cero o revisión vencida se oculta. **Cupos por revisar** reúne referencias vencidas de salidas publicadas y vigentes.

## CSV

La exportación añade `available_seats` y `last_seats`. Son opcionales al importar:

| Valor | Resultado |
| --- | --- |
| `available_seats=0` | Fija cero cupos |
| `available_seats=15` | Fija 15 cupos actuales |
| `last_seats=true` / `false` | Activa/desactiva la etiqueta |
| Columna ausente o celda vacía | Conserva en actualizaciones; en altas usa el inicial del programa |

Las cantidades y etiquetas pueden diferir entre fechas del mismo MTPE. Valida primero: el reporte muestra valores efectivos por fila. Confirma que las cifras representan disponibilidad actual antes de aplicar. Si cambia un saldo tras validar, revalida el archivo. Importar contenido sin cupos conserva revisión. Mantén `source_key` para actualizar sin duplicar. En CLI, valida con `npm run import:cms -- archivo.csv --skip-images`, revisa `migration/import-report-dry-run.json` y aplica con `npm run import:cms -- archivo.csv --commit --confirm-seats --skip-images`. El CLI reutiliza los comprobantes del reporte y exige revalidar si cambió el archivo o saldo.

## Reservas por correo

`MTPE-50026` identifica el programa. `MTP-12345` y `Reserva: 12345` identifican la misma reserva; se conservan ceros iniciales. Se reconoce MTP en asunto, texto, HTML y reenvíos. Varios MTP o referencias contradictorias bloquean movimientos. No se cuentan pasajeros ni números aislados.

La fecha es obligatoria salvo que el programa tenga una única fecha registrada. Si esa fecha tiene varios orígenes, identifica uno en `Origen: Lima`. No se selecciona por publicación o disponibilidad.

La primera recepción activa descuenta de esa salida. La misma reserva conserva saldo si no cambia cantidad y aplica solo la diferencia cuando cambia. Una cancelación conocida devuelve exclusivamente lo ocupado. Un cambio inequívoco de fecha/origen devuelve la cantidad anterior y descuenta la nueva en una transacción. Saldo insuficiente, identidad dudosa o cancelación contradictoria producen observación sin alterar saldos. Sin reserva, estados activos se aplican por mensaje con advertencia; cancelaciones se observan.

Se comprueban versión/fecha comercial, UID/recepción persistentes y conciliación de cada salida afectada. La reserva guarda programa original e identidad estable de salida. No se enlaza historial antiguo a registros recreados por coincidir en MTPE. La simulación requiere saldo inicial por salida y sigue las mismas reglas. Saldo, reserva, auditoría, movimientos, evento y progreso del lector se confirman juntos.

**Correos observados** distingue MTPE, reserva MTP, fecha de viaje, origen y motivo. El cuerpo permanece en el buzón. Se conservan configuración del buzón, cron y variables de modo real/simulación. Véase [operación Gmail](gmail-cupos-piloto.md).

## Migración y corte operativo

1. Respaldar y probar en staging `20261113_180329_independent_departure_seats` con `npm run migrate`. Conserva IDs, saldos, historial, deduplicación y cursores; no rellena conciliaciones ni vincula registros antiguos. La reversión se bloquea si existen datos nuevos que se perderían.
2. En SQLite local, detener el servidor y ejecutar `npm run db:prepare:local`. Genera respaldo, verifica datos/integridad e incorpora la columna a preferencias guardadas. No consolida saldos.
3. Validar una carga nueva con disponibilidades actuales por fecha/origen. Revisar ceros, etiquetas, conciliaciones y catálogo antes del corte. **No se trasladan ni se borran automáticamente saldos anteriores.** Retirar datos antiguos requiere una operación explícita del equipo.
4. Verificar un aviso posterior al inicio global y a la conciliación de la salida; comprobar saldo, historial y observaciones. Las continuidades históricas dudosas requieren revisión manual. El antiguo `migrate:seats:sqlite` está retirado.

Pruebas: `npm test`, `npm run test:integration`, `npm run test:departure-seats`, `npm run test:panel-pilot`, `npm run test:gmail-pilot`, `npm run test:local-schema`, `npm run test:seats-migration`, `npm run typecheck`, `npm run build`. La prueba de migración usa PostgreSQL embebido PGlite; no acredita adaptador ni bloqueos entre procesos de staging. Comprobar ambos allí antes del corte.
