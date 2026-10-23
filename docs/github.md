# Git, GitHub y trabajo desde varios ordenadores

## Qué está preparado y qué sigue pendiente

Se inicializó un repositorio local con rama `main`. El usuario creó el repositorio de GitHub y realizará su vinculación y push. No se configuró `origin` ni se contactó ese repositorio desde esta preparación.

El intento de preparar archivos fue rechazado por el entorno al escribir `.git/index.lock`. Por ello **todavía no hay commits creados por el asistente**. El código y la documentación están listos en el directorio de trabajo, y el script siguiente permite crear los dos commits desde una terminal normal con permisos de escritura.

Este estado corresponde al cierre de la sesión documental del 23 de octubre de 2026. Después de ejecutar el script, el estado vigente se consulta con `git log` y `git status`, no con este registro histórico.

## Crear los dos commits locales

Ejecutar en la carpeta del proyecto:

```powershell
# Revisión sin escribir el índice ni crear commits.
npm.cmd run prepare:commits -- --plan

# Crear los dos commits locales.
npm.cmd run prepare:commits
```

El script `scripts/prepare-commits.mjs` prepara estos bloques:

| Commit | Contenido |
| --- | --- |
| `chore: versionar base del catalogo Megatravel y preparar Git` | Código, configuración, lockfile, pruebas, scripts, recursos y datos normalizados |
| `docs: documentar arquitectura, mantenimiento, datos y produccion` | README y documentación técnica/operativa |

Antes de escribir comprueba raíz y rama, que no haya otro índice preparado, identidad Git, archivos requeridos y un control básico de rutas/patrones de secretos. Después de preparar cada bloque revisa el índice y los espacios en el diff. No ejecuta el build, pruebas del CMS, importación, despliegue ni comandos de red.

La comprobación de patrones no sustituye una revisión humana del contenido a publicar. Los datos de migración contienen historial comercial: mantener este repositorio privado salvo decisión expresa de publicar esos datos.

Si el primer commit se crea pero la segunda fase falla **antes de preparar archivos**, se puede revisar el estado y reanudar con:

```powershell
npm.cmd run prepare:commits -- --docs-only
```

Si ya hay documentos en el índice, el script se detiene para no mezclar cambios. En ese caso revisa `git diff --cached` y completa el commit de documentación con el flujo normal que se muestra abajo. Si ya existen ambos commits, no vuelvas a usar el comando de preparación inicial para cambios cotidianos.

Comprueba el resultado:

```powershell
git log -2 --oneline
git status --short
```

No se necesitan credenciales de GitHub para crear commits locales. Git sí requiere nombre y correo de autor configurados. Esta revisión encontró identidad Git en el equipo y no modificó esos valores globales.

## Vincular el repositorio que ya creaste

Sustituir la URL por la real del repositorio; `TU_USUARIO` es un marcador, no una cuenta configurada:

```powershell
git remote add origin https://github.com/TU_USUARIO/megatravel-bloqueos.git
git remote -v
git push -u origin main
```

Si ya existe un `origin`, inspeccionarlo antes de modificarlo. El push debe ejecutarse con la cuenta que tiene permiso en el repositorio. No colocar un token o contraseña dentro de la URL ni pegarlo en el código. El asistente deja la vinculación al usuario conforme a su instrucción.

GitHub explica este flujo para añadir código local a un repositorio existente. Si el remoto se creó con README u otros commits iniciales, hay que integrar su historial antes de publicar; no se debe resolver sobrescribiéndolo con `push --force`. [Añadir código local a GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).

## Qué se versiona y qué no

| Se incluye | Motivo |
| --- | --- |
| Código `src/`, scripts y pruebas | Permite reconstruir y desarrollar la aplicación |
| `package.json` y `package-lock.json` | Reinstalación coherente de paquetes |
| `.env.example` | Plantilla compartida sin credenciales reales |
| Docker/Next/Railway/TypeScript y `.nvmrc` | Configuración reproducible |
| `public/` y la instantánea preparada | Recursos que forman parte de esa versión del catálogo |
| Datos normalizados y reportes de preparación no ignorados | Material de migración incluido en esta entrega privada |
| Documentación | Mapa de mantenimiento y operación |

| Se excluye | Cómo se conserva o reconstruye |
| --- | --- |
| `.env.local` y demás secretos de entorno | Configurar de forma privada en cada equipo/proveedor |
| `node_modules/` | `npm ci` |
| `.next/`, cachés y archivos temporales | Volver a generar cuando se retomen los comandos correspondientes |
| Excel original y `migration/raw-workbook.json` | Guardar el original de forma separada; el CSV normalizado sí está disponible en el proyecto |
| Bases SQLite y dumps | Respaldos privados de los entornos |
| `media/` y volumen local PostgreSQL | Persistencia/backup propios; en producción se utiliza el bucket y la base |
| Archivos de claves privadas y configuración npm local | Gestores y configuración privada |

GitHub no sustituye una copia de PostgreSQL o R2. Los cambios comerciales hechos en el panel tampoco se obtienen con `git pull`: permanecen en la base configurada.

## Primer uso desde otro ordenador

Instalar una versión de Node compatible y Git. Después:

```powershell
git clone https://github.com/TU_USUARIO/megatravel-bloqueos.git
Set-Location megatravel-bloqueos
npm.cmd ci
Copy-Item .env.example .env.local
```

Completar `.env.local` con los valores del entorno de desarrollo. No copiar una base de producción ni su clave de administración sin un motivo operativo revisado. La guía de [configuración](configuracion.md) distingue instantánea, SQLite y PostgreSQL.

La copia de `.env.example` es solo la primera vez. Repetirla sobrescribe la configuración local. Para usar un Excel distinto, conservar una copia del original fuera de Git y señalar su ruta al preparador cuando corresponda.

## Flujo diario para evitar perder cambios

Antes de comenzar en un equipo:

```powershell
git status
git switch main
git pull --ff-only
git switch -c cambio/descripcion-breve
```

Si ya hay trabajo sin guardar, no cambiar de rama sin revisarlo. Guardarlo mediante un commit en su rama o terminar esa tarea primero. `pull --ff-only` se detiene cuando hay historias divergentes, en lugar de crear una mezcla que pase inadvertida.

Al terminar el cambio:

```powershell
git diff
# Preparar únicamente los archivos de esta tarea, por ejemplo:
git add -- docs/mantenimiento.md
git diff --cached
node scripts/check-repository.mjs
git diff --cached --check
git commit -m "docs: aclarar el flujo de mantenimiento"
git push -u origin cambio/descripcion-breve
```

Abrir un pull request a `main` permite revisar qué cambia antes de integrarlo. Para continuar exactamente esa rama en otro ordenador:

```powershell
git fetch origin
git switch cambio/descripcion-breve
git pull --ff-only
```

Tras incorporar cambios de dependencias, volver a ejecutar `npm ci`. Tras cambiar el modelo de datos, revisar la generación de tipos y migraciones cuando se retome esa etapa. Para un cambio de documentación no hace falta ejecutar operaciones sobre la base.

## Problemas frecuentes

| Mensaje o situación | Qué hacer |
| --- | --- |
| `index.lock: Permission denied` | Usar una terminal con permiso real sobre `.git`. Si el mensaje es de permiso, no asumir que existe un lock antiguo ni borrarlo sin comprobar otro proceso Git |
| `Author identity unknown` | Configurar nombre/correo del autor en ese equipo con `git config` |
| `remote origin already exists` | Revisar `git remote -v`; no reemplazar una URL a ciegas |
| Push rechazado por historial diferente | Hacer fetch y revisar el historial; conservar el trabajo del remoto antes de integrarlo |
| Cambios distintos en el mismo archivo | Resolver el conflicto en la rama correspondiente y revisar el resultado antes de commitear |
| Falta `.env.local` después de clonar | Es intencional; configurarlo desde la plantilla y el almacén privado de valores |
| Git no muestra cambios del CMS | Es contenido de la base, no código versionado |
| `.next/` o `node_modules/` aparece entre candidatos | Revisar exclusiones antes de preparar el commit |

No se utiliza `reset --hard`, limpieza recursiva ni push forzado como parte de esta preparación.
