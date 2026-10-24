// Integration verification in an isolated, disposable SQLite DB. Run after installing dependencies.
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
process.env.USE_SQLITE = 'true'
Object.assign(process.env, { NODE_ENV: 'test' })
process.env.PAYLOAD_SECRET = randomUUID() + randomUUID()
process.env.SQLITE_URL = 'file:./.qa/cms-' + randomUUID() + '.db'
process.env.MEDIA_DIR = path.resolve('.qa', 'media-' + randomUUID())
process.env.R2_BUCKET = ''
await mkdir('.qa', { recursive: true })
const [{ getPayload, createLocalReq }, { default: config }, { importCSV }, { cmsToDeparture }, { publishedPackages }] = await Promise.all([
  import('payload'), import('../src/payload.config'), import('../src/server/import-service'), import('../src/server/normalize'), import('../src/lib/catalog'),
])
const payload = await getPayload({ config })
let checks = 0
try {
  const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { bootstrap: true }, data: { name: 'Administrador de prueba', email: 'admin@example.test', password: randomUUID(), role: 'admin' } })
  const adminReq = await createLocalReq({ user: { ...admin, collection: 'users' } }, payload)
  const editor = await payload.create({ collection: 'users', req: adminReq, overrideAccess: false, data: { name: 'Editor de prueba', email: 'editor@example.test', password: randomUUID(), role: 'editor' } })
  const req = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8XcAAAAASUVORK5CYII=', 'base64')
  const uploaded = await payload.create({ collection: 'media', req, overrideAccess: false, data: { alt: 'Imagen de prueba de persistencia' }, file: { data: image, size: image.length, mimetype: 'image/png', name: 'persistence.png' } })
  assert.ok(uploaded.filename)
  assert.ok((await readFile(path.join(process.env.MEDIA_DIR, uploaded.filename))).length > 0); checks++
  await assert.rejects(() => payload.create({ collection: 'users', req, overrideAccess: false, data: { name: 'Prohibido', email: 'forbidden@example.test', password: randomUUID(), role: 'admin' } })); checks++
  await assert.rejects(() => payload.findGlobal({ slug: 'settings', req, overrideAccess: false })); checks++
  const destination = await payload.create({ collection: 'destinations', req, overrideAccess: false, data: { name: 'Madrid' } })
  const origin = await payload.create({ collection: 'origins', req, overrideAccess: false, data: { name: 'Lima' } })
  const date = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10)
  let departure = await payload.create({ collection: 'departures', req, overrideAccess: false, context: { skipMediaDownload: true }, data: { program: 'Programa de prueba', mtpe: 'TEST1', destination: destination.id, zone: 'Europa', origin: origin.id, days: 10, travelDate: date, price: 3999, currency: 'USD', priceCondition: 'Por persona en habitación doble', flyerSourceUrl: 'https://i.imgur.com/example.png', bookingUrl: 'https://www.megatravel.pe/es/', descriptionUrl: 'https://cafe.megatravel.pe/', status: 'published', advanceDays: 30 } })
  assert.ok(departure.withdrawalAt); checks++
  await assert.rejects(() => payload.find({ collection: 'departures', overrideAccess: false })); checks++
  await assert.rejects(() => payload.find({ collection: 'audit-log', overrideAccess: false })); checks++
  await assert.rejects(() => payload.update({ collection: 'departures', id: departure.id, req, overrideAccess: false, data: { status: 'withdrawn', withdrawalReason: 'other', withdrawalNote: '' } })); checks++
  departure = await payload.update({ collection: 'departures', id: departure.id, req, overrideAccess: false, data: { status: 'withdrawn', withdrawalReason: 'sold-out' } })
  assert.equal(publishedPackages([cmsToDeparture(departure)]).length, 0)
  assert.equal(typeof departure.retiredBy === 'object' ? departure.retiredBy?.id : departure.retiredBy, editor.id); checks++
  await assert.rejects(() => payload.update({ collection: 'departures', id: departure.id, req, overrideAccess: false, data: { status: 'published' } })); checks++
  departure = await payload.update({ collection: 'departures', id: departure.id, req, overrideAccess: false, data: { status: 'published', reviewConfirmed: true } })
  assert.equal(departure.reviewConfirmed, false); checks++
  const logs = await payload.find({ collection: 'audit-log', req, overrideAccess: false, where: { departureId: { equals: departure.stableId } }, depth: 0 })
  assert.ok(logs.docs.some(log => log.event === 'withdrawn' && log.actorLabel === editor.email))
  assert.ok(logs.docs.some(log => log.event === 'reactivated')); checks++
  const publicItem = publishedPackages([cmsToDeparture(departure)])[0]
  assert.ok(publicItem); assert.equal('withdrawalNote' in publicItem, false); checks++
  const csv = 'source_key,program,mtpe,destination,zone,origin,days,travel_date,price,currency,flyer_url,booking_url,description_url,status\nimport-test,Programa importado,TEST2,Madrid,Europa,Lima,10,' + date + ',1999,USD,https://i.imgur.com/example.png,https://www.megatravel.pe/es/,https://cafe.megatravel.pe/,draft'
  const first = await importCSV(payload, csv, req, { dryRun: false, downloadImages: false })
  const second = await importCSV(payload, csv.replace(',1999,', ',2099,'), req, { dryRun: false, downloadImages: false })
  assert.equal(first.errors, 0); assert.equal(second.errors, 0)
  const imported = await payload.find({ collection: 'departures', req, overrideAccess: false, where: { sourceKey: { equals: 'import-test' } } })
  assert.equal(imported.totalDocs, 1); assert.equal(imported.docs[0].price, 2099); checks++
  const dry = await importCSV(payload, csv.replace('import-test', 'dry-run-test'), req, { dryRun: true, downloadImages: false })
  assert.equal(dry.errors, 0)
  assert.equal((await payload.count({ collection: 'departures', overrideAccess: true, where: { sourceKey: { equals: 'dry-run-test' } } })).totalDocs, 0); checks++
  console.log(`${checks} comprobaciones de integración correctas. Base aislada: ${process.env.SQLITE_URL}`)
} finally { await payload.destroy() }
