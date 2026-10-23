import { readdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let ts
try { ts = require('typescript') } catch { ts = require('../.qa/package/lib/typescript.js') }
let count = 0, failed = false
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = directory + '/' + entry.name
    if (entry.isDirectory()) await check(file)
    else if (/\.(ts|tsx|mjs|js)$/.test(file) && !file.endsWith('.d.ts')) {
      const source = await readFile(file, 'utf8')
      const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, isolatedModules: true, verbatimModuleSyntax: true } })
      const errors = result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) || []
      if (errors.length) { failed = true; for (const error of errors) console.error(file + ': ' + ts.flattenDiagnosticMessageText(error.messageText, '\n')) }
      count++
    }
  }
}
await check('src'); await check('scripts')
console.log(`${count} archivos comprobados con TypeScript ${ts.version}. Esta comprobación de sintaxis no sustituye typecheck ni build con las dependencias instaladas.`)
if (failed) process.exitCode = 1
