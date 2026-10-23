import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let ts
try { ts = require('typescript') } catch { ts = require('../.qa/package/lib/typescript.js') }
const program = ts.createProgram(['src/lib/types.ts', 'src/lib/catalog.ts', 'src/lib/lifecycle.ts', 'src/lib/csv.ts', 'src/lib/import-records.ts'], {
  noEmit: true, strict: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'], module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
})
const diagnostics = ts.getPreEmitDiagnostics(program)
for (const diagnostic of diagnostics) {
  const position = diagnostic.file && diagnostic.start != null ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start) : null
  console.error((diagnostic.file ? diagnostic.file.fileName + (position ? ':' + (position.line + 1) : '') + ': ' : '') + ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
}
if (diagnostics.length) process.exitCode = 1
else console.log('Tipos del dominio de catálogo, CSV y publicación: correctos.')
