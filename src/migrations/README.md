Esta carpeta corresponde al esquema de PostgreSQL. No contiene los datos del Excel: esos están en `migration/`, en la raíz del proyecto. Para el contexto completo, consulta [arquitectura](../../docs/arquitectura.md), [configuración](../../docs/configuracion.md) y [operación](../../docs/operacion.md).

Las migraciones de PostgreSQL deben generarse con las dependencias instaladas y el entorno de staging configurado:

```sh
npm run migrate:create -- inicial
npm run migrate
```

Revisar y versionar los archivos generados antes de ejecutar en producción. La aplicación usa `push: false` en producción; no modifica el esquema automáticamente. En la implementación inicial no se generó ni verificó una migración inicial. Su preparación y prueba siguen pendientes; no se ejecutan en la etapa de documentación y repositorio. El despliegue queda condicionado a validarlas en staging.
