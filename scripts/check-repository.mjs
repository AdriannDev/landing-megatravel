import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const projectRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
function git(args) {
  return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
}

export function checkRepository({ workingTree = false } = {}) {
  const output = workingTree
    ? git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    : git(['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'])
  const files = [...new Set(output.split('\0').filter(Boolean))]
  const forbiddenDirectories = new Set(['node_modules', '.next', '.qa', '.npm-cache', 'backups', 'media', '.aws', '.ssh', 'out'])
  const patterns = [/github_pat_[A-Za-z0-9_]{20,}/, /gh[pousr]_[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]
  const errors = []
  let bytes = 0
  for (const file of files) {
    const segments = file.split('/'), name = segments.at(-1)
    if (segments.some(segment => forbiddenDirectories.has(segment)) ||
      (name.startsWith('.env') && name !== '.env.example') || name === '.npmrc' ||
      /\.(xlsx|dump|db|pem|key|pfx|p12)$/.test(name) || file === 'migration/raw-workbook.json') {
      errors.push({ file, reason: 'Archivo local o privado que debe quedar fuera del repositorio.' })
      continue
    }
    const content = workingTree ? readFileSync(path.join(projectRoot, file)) : execFileSync('git', ['show', ':' + file], { cwd: projectRoot, maxBuffer: 60 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
    bytes += content.length
    if (content.length > 50 * 1024 * 1024) errors.push({ file, reason: 'Archivo mayor que 50 MB; revisar su forma de almacenamiento.' })
    if (!/\.(png|jpe?g|gif|webp|ico)$/.test(name) && patterns.some(pattern => pattern.test(content.toString('utf8')))) {
      errors.push({ file, reason: 'Posible token o clave privada. El valor no se imprime.' })
    }
  }
  return { scope: workingTree ? 'working-tree' : 'staged', files: files.length, bytes, errors }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = checkRepository({ workingTree: process.argv.includes('--working-tree') })
    console.log(JSON.stringify(result, null, 2))
    if (result.errors.length) process.exitCode = 1
  } catch (error) { console.error('No se pudo revisar el repositorio: ' + error.message); process.exitCode = 1 }
}
