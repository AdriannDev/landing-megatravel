# Cupos compartidos por programa

El saldo se administra en **Programas → Cupos compartidos del programa**. Si un programa tiene 15 cupos y se toman 3 en cualquiera de sus fechas, cambia el saldo a 12: todas las fechas y orígenes del programa mostrarán 12. El panel no recibe reservas de Meganet; el saldo se actualiza manualmente.

- La cantidad es opcional. Vacío significa sin cantidad informada; cero significa sin cupos y oculta las etiquetas públicas de urgencia.
- **Últimos cupos en todas las fechas** activa la etiqueta grupal.
- **Últimos cupos solo en esta fecha**, en Salidas, activa la etiqueta individual. Desactivarla no anula una etiqueta grupal activa. Desactivar la grupal conserva las etiquetas individuales.
- Nueva salida permite indicar el saldo al crear un programa. Seleccionar un programa existente o usar Nueva fecha reutiliza su saldo; no se copia ni se modifica una cantidad por fecha.
- Se conserva la vigencia configurada de las referencias (72 horas por defecto). Confirmar una etiqueta individual no renueva la revisión de la cantidad compartida.

## Datos anteriores

La migración conserva una copia de los valores por fecha. Si todas las cantidades informadas coinciden, se conserva esa cantidad y su revisión más antigua. Si difieren, el saldo queda vacío y se marca **Revisión pendiente de cupos anteriores**. Se resuelve indicando y revisando el saldo correcto en Programas.

En desarrollo con SQLite, ejecutar antes de arrancar la nueva versión:

```sh
npm run migrate:seats:sqlite
npm run migrate:seats:sqlite -- --apply
```

El primer comando muestra una previsión sin escribir; el segundo crea un respaldo en `backups/` y migra en una transacción. Puede repetirse sin sobrescribir los saldos ya revisados. La base local se migró durante esta implementación: 97 programas, sin conflictos.

En PostgreSQL, la migración de Payload `20261102_173707_program_shared_seats` realiza la transición al desplegar la versión. Se verificó en PostgreSQL embebido; no se ejecutó contra producción. Su reversión bloquea la pérdida de saldos o respaldos que requieren conciliación.

## Imágenes

Se retiró el campo y la lógica de **Resultado de copia del flyer**. Los nombres visibles usan «imagen»; las claves internas existentes se mantienen para conservar los archivos y sus enlaces.

| Uso | Tamaño ideal |
| --- | --- |
| Programa y tarjeta de salida | 800 × 800 px |
| Banner Hero, entre resultados o final del catálogo | 1600 × 600 px |
| Imagen de popup | 1200 × 900 px |
| Versión móvil del banner o popup | 800 × 800 px |

Se admiten otros tamaños y proporciones; la presentación muestra la imagen completa. Los campos indican estas recomendaciones y el límite de 12 MB. Sin versión móvil se utiliza la imagen de escritorio.

## Verificación

Pasaron 55 pruebas automatizadas, 62 comprobaciones de integración, la comprobación de tipos y la compilación. La migración se probó en SQLite y PostgreSQL embebido. En navegador, editar de 15 a 12 el saldo de un programa de prueba actualizó sus 19 fechas y sus 16 fechas públicas; la etiqueta grupal se reflejó en todas ellas. Las pruebas de integración comprobaron también que las etiquetas individuales se conservan al desactivar la grupal y que ninguna de ellas altera el saldo.
