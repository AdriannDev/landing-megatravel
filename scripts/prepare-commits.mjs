import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { checkRepository, projectRoot } from './check-repository.mjs'

const planOnly = process.argv.includes('--plan')
const docsOnly = process.argv.includes('--docs-only')
const baseMessage = 'chore: versionar base del catalogo Megatravel y preparar Git'
const docsMessage = 'docs: documentar arquitectura, mantenimiento, datos y produccion'
const basePaths = [
  '.env.example', '.gitignore', '.gitattributes', '.nvmrc', '.dockerignore',
  'package.json', 'package-lock.json', 'Dockerfile', 'compose.yaml', 'railway.toml',
  'next-env.d.ts', 'next.config.mjs', 'postcss.config.mjs', 'tsconfig.json', 'components.json',
  'src', 'scripts', 'tests', 'public', 'migration',
]
const documentationPaths = ['README.md', 'docs']

function git(args, allowedFailure = false) {
  const result = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  if (result.error) throw result.error
  if (!allowedFailure && result.status !== 0) throw new Error(result.stderr?.trim() || `Git terminó con código ${result.status}.`)
  return result
}
function assertCheck(result) {
  if (result.errors.length) throw new Error(result.errors.map(error => error.file + ': ' + error.reason).join('\n'))
}
function commitPaths(paths, message) {
  git(['-c', 'core.safecrlf=false', 'add', '--', ...paths])
  assertCheck(checkRepository())
  git(['diff', '--cached', '--check'])
  const changes = git(['diff', '--cached', '--quiet'], true)
  if (changes.status === 0) { console.log('Sin cambios para: ' + message); return }
  if (changes.status !== 1) throw new Error(changes.stderr || 'No se pudo comprobar el índice de Git.')
  const commit = git(['commit', '-m', message])
  console.log(commit.stdout.trim())
}

try {
  for (const file of [...basePaths, ...documentationPaths]) if (!existsSync(path.join(projectRoot, file))) throw new Error('Falta un archivo o carpeta del proyecto: ' + file)
  if (!existsSync(path.join(projectRoot, '.git'))) {
    if (planOnly) throw new Error('Primero se debe inicializar el repositorio local con git init -b main.')
    git(['init', '-b', 'main'])
  }
  const root = path.resolve(git(['rev-parse', '--show-toplevel']).stdout.trim())
  if (root !== projectRoot) throw new Error('La raíz de Git no coincide con la carpeta del proyecto.')
  const branch = git(['symbolic-ref', '--short', 'HEAD']).stdout.trim()
  if (branch !== 'main') throw new Error('La preparación inicial espera la rama main. No se cambió la rama actual.')
  if (git(['diff', '--cached', '--name-only']).stdout.trim()) throw new Error('Hay cambios preparados previamente. Revísalos antes de ejecutar este comando para no mezclarlos.')
  const head = git(['rev-parse', '--verify', 'HEAD'], true)
  if (docsOnly) {
    if (head.status !== 0 || git(['log', '-1', '--format=%s']).stdout.trim() !== baseMessage) throw new Error('--docs-only solo reanuda después del commit base generado por este script.')
  } else if (head.status === 0) throw new Error('Ya existe historial. Para cambios posteriores usa el flujo normal de git add y git commit; este comando es solo para la preparación inicial.')
  for (const key of ['user.name', 'user.email']) if (!git(['config', '--get', key], true).stdout?.trim()) throw new Error('Configura tu identidad Git (' + key + ') antes de crear commits.')
  const report = checkRepository({ workingTree: true })
  assertCheck(report)
  console.log(`Preparación revisada: ${report.files} archivos candidatos, ${report.bytes} bytes.`)
  const phases = docsOnly ? [[documentationPaths, docsMessage]] : [[basePaths, baseMessage], [documentationPaths, docsMessage]]
  for (const [, message] of phases) console.log('Commit previsto: ' + message)
  if (planOnly) console.log('Modo de revisión: no se escribió el índice, no se crearon commits y no se contactó ningún remoto.')
  else {
    for (const [paths, message] of phases) commitPaths(paths, message)
    console.log(git(['log', '-2', '--oneline']).stdout.trim())
    console.log('Commits locales preparados. Vincula tu repositorio y ejecuta el push cuando corresponda.')
  }
} catch (error) {
  console.error(error.message)
  console.error('No se hizo push ni se modificaron remotos. Si se bloquea .git/index.lock, ejecuta este comando en tu terminal habitual con permiso de escritura sobre el proyecto.')
  process.exitCode = 1
}
