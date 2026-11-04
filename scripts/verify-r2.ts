// Exercise the real S3 adapter against a local HTTP stub, never a Cloudflare account.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const received: { path: string; body: Buffer; type?: string }[] = []
const server = createServer((req, res) => {
  if (req.method !== 'PUT') { res.writeHead(404).end(); return }
  const chunks: Buffer[] = []
  req.on('data', chunk => chunks.push(Buffer.from(chunk)))
  req.on('end', () => {
    received.push({ path: req.url || '', body: Buffer.concat(chunks), type: req.headers['content-type'] })
    res.writeHead(200, { ETag: '"test-etag"' }).end()
  })
})
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
if (!address || typeof address === 'string') throw new Error('No se pudo iniciar el servidor de prueba.')
Object.assign(process.env, {
  NODE_ENV: 'test', USE_SQLITE: 'true', SQLITE_URL: `file:./.qa/r2-${randomUUID()}.db`,
  PAYLOAD_SECRET: randomUUID() + randomUUID(), R2_BUCKET: 'test-bucket',
  R2_ENDPOINT: `http://127.0.0.1:${address.port}`, R2_ACCESS_KEY_ID: 'test', R2_SECRET_ACCESS_KEY: 'test',
  R2_PUBLIC_URL: 'https://images.example.test', AWS_REQUEST_CHECKSUM_CALCULATION: 'WHEN_REQUIRED',
})
await mkdir('.qa', { recursive: true })
let payload: Awaited<ReturnType<typeof import('payload')['getPayload']>> | undefined
try {
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('../src/payload.config')])
  payload = await getPayload({ config })
  const original = await sharp({ create: { width: 2200, height: 1100, channels: 3, background: '#2468ab' } }).png().toBuffer()
  const doc = await payload.create({ collection: 'media', overrideAccess: true, data: { alt: 'Prueba R2 aislada' }, file: { data: original, size: original.length, mimetype: 'image/png', name: 'flyer verano #1.png' } })
  assert.equal(received.length, 1)
  assert.match(received[0].path, /\/test-bucket\//)
  assert.equal(received[0].type, 'image/webp')
  const metadata = await sharp(received[0].body).metadata()
  assert.equal(metadata.format, 'webp'); assert.equal(metadata.width, 1600); assert.equal(metadata.height, 800)
  assert.ok(received[0].body.length < original.length)
  assert.ok(doc.url?.startsWith('https://images.example.test/'))
  assert.equal(decodeURIComponent(new URL(doc.url!).pathname), decodeURIComponent(new URL(received[0].path, 'http://localhost').pathname.replace(/^\/test-bucket/, '')))
  console.log('Adaptador S3: archivo WebP optimizado y URL pública verificados con servidor local simulado.')
} finally {
  if (payload) await payload.destroy()
  await new Promise<void>(resolve => server.close(() => resolve()))
}
