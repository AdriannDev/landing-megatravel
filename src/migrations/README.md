Esta carpeta corresponde al esquema de PostgreSQL. No contiene los datos del Excel: esos están en `migration/`, en la raíz del proyecto. Para el contexto completo, consulta [arquitectura](../../docs/arquitectura.md), [configuración](../../docs/configuracion.md) y [operación](../../docs/operacion.md).

Las migraciones de PostgreSQL deben generarse con las dependencias instaladas y el entorno de staging configurado:

```sh
npm run migrate:create -- inicial
npm run migrate
```

Revisar y versionar los archivos generados antes de ejecutar en producción. La aplicación usa `push: false` en producción; no modifica el esquema automáticamente. Al 24 de octubre de 2026 no se generó ni verificó una migración inicial PostgreSQL. Las pruebas locales de Payload con SQLite no validan ese esquema. Su preparación y prueba siguen pendientes de disponer del entorno PostgreSQL; el despliegue queda condicionado a validarlas en staging. Consultar [el estado actual](../../docs/continuidad.md).
