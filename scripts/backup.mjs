import { spawn } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

const restore = process.argv.includes('--restore')
const sourceUrl = process.env.DATABASE_URL, targetUrl = process.env.RESTORE_DATABASE_URL
if (!sourceUrl) throw new Error('Configura DATABASE_URL en el entorno.')
if (restore && (!targetUrl || targetUrl === sourceUrl || !new URL(targetUrl).pathname.endsWith('_restore'))) throw new Error('La restauración de prueba necesita RESTORE_DATABASE_URL distinta, con base terminada en _restore.')
await mkdir('backups', { recursive: true })
const filename = restore ? process.argv.find(a => a.endsWith('.dump')) : path.join('backups', 'megatravel-' + new Date().toISOString().replace(/[:.]/g, '-') + '.dump')
if (!filename) throw new Error('Indica el archivo .dump a restaurar.')
const absolute = path.resolve(filename), root = path.resolve('backups') + path.sep
if (!absolute.startsWith(root)) throw new Error('El archivo debe estar dentro de backups/.')
if (restore) await stat(absolute)
const url = new URL(restore ? targetUrl : sourceUrl)
const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: url.pathname.slice(1), ...(url.searchParams.get('sslmode') ? { PGSSLMODE: url.searchParams.get('sslmode') } : {}) }
const command = restore ? 'pg_restore' : 'pg_dump'
// Connection credentials travel via environment, never process arguments or logs.
const args = restore ? ['--clean', '--if-exists', '--exit-on-error', '--no-owner', '--dbname', env.PGDATABASE, absolute] : ['--format=custom', '--no-owner', '--file', absolute]
await new Promise((resolve, reject) => {
  const child = spawn(command, args, { env, stdio: ['ignore', 'inherit', 'inherit'] })
  child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(command + ' terminó con código ' + code)))
})
console.log(restore ? 'Restauración de prueba finalizada. Verifica recuentos, acceso y catálogo en la base de prueba.' : 'Copia creada: ' + absolute)
