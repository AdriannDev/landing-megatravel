import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const allowedHosts = new Set(['i.imgur.com', 'i.spread.name'])
const urls = JSON.parse(await readFile('migration/asset-urls.json', 'utf8'))
let manifest = {}
try { manifest = JSON.parse(await readFile('migration/assets.json', 'utf8')) } catch {}
await mkdir('public/flyers', { recursive: true })
const failures = [], maxBytes = 12 * 1024 * 1024
const selected = process.argv.includes('--probe') ? urls.slice(0, 1) : urls
for (const sourceUrl of selected) {
  if (manifest[sourceUrl]?.localUrl) continue
  try {
    const url = new URL(sourceUrl)
    if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) throw new Error('Host no autorizado para la migración')
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error' })
    if (!response.ok) throw new Error('HTTP ' + response.status)
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Imagen mayor que 12 MB')
    const chunks = []; let size = 0
    for await (const chunk of response.body) {
      size += chunk.length
      if (size > maxBytes) { await response.body.cancel().catch(() => {}); throw new Error('Imagen mayor que 12 MB') }
      chunks.push(chunk)
    }
    const bytes = Buffer.concat(chunks)
    const hex = bytes.subarray(0, 12).toString('hex')
    const ext = hex.startsWith('89504e470d0a1a0a') ? 'png' : hex.startsWith('ffd8ff') ? 'jpg' : bytes.toString('ascii', 0, 3) === 'GIF' ? 'gif' : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null
    if (!ext) throw new Error('La URL no devuelve PNG, JPEG, GIF ni WebP')
    const filename = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 24) + '.' + ext
    await writeFile('public/flyers/' + filename, bytes)
    manifest[sourceUrl] = { localUrl: '/flyers/' + filename, bytes: size, sourceUrl, downloadedAt: new Date().toISOString() }
    console.log('Descargada ' + filename)
  } catch (error) {
    const message = error.cause?.code || error.code || error.message
    failures.push({ sourceUrl, error: message })
    if (['EACCES', 'EPERM'].includes(message)) { console.log('Red bloqueada por el entorno; se conservan los enlaces de origen.'); break }
  }
}
await writeFile('migration/assets.json', JSON.stringify(manifest, null, 2))
await writeFile('migration/download-report.json', JSON.stringify({ attempted: selected.length, downloaded: Object.keys(manifest).length, failures, pending: urls.filter(url => !manifest[url]?.localUrl) }, null, 2))
console.log(JSON.stringify({ downloaded: Object.keys(manifest).length, failures: failures.length, pending: urls.filter(url => !manifest[url]?.localUrl).length }))
