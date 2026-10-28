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
const { createDepartures, duplicateDepartures } = await import('../src/server/departure-service')
const { prepareProgramMigration, applyProgramMigration, revertProgramMigration } = await import('../src/server/program-migration')
const { departureViewWhere } = await import('../src/lib/admin-views')
const { DEFAULT_FLYER } = await import('../src/lib/flyer')
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
  assert.equal(first.errors, 0, JSON.stringify(first)); assert.equal(second.errors, 0, JSON.stringify(second))
  const imported = await payload.find({ collection: 'departures', req, overrideAccess: false, where: { sourceKey: { equals: 'import-test' } } })
  assert.equal(imported.totalDocs, 1); assert.equal(imported.docs[0].price, 2099); checks++
  const dry = await importCSV(payload, csv.replace('import-test', 'dry-run-test').replace(date, '2029-06-10'), req, { dryRun: true, downloadImages: false })
  assert.equal(dry.errors, 0)
  assert.equal((await payload.count({ collection: 'departures', overrideAccess: true, where: { sourceKey: { equals: 'dry-run-test' } } })).totalDocs, 0); checks++
  await assert.rejects(() => payload.find({ collection: 'programs', overrideAccess: false })); checks++
  const input = { program: { program: 'Programa compartido', mtpe: ' shared1 ', destination: 'Cusco', zone: 'Perú', days: 5, nights: 4, bookingUrl: 'https://www.megatravel.pe/es/', descriptionUrl: 'https://cafe.megatravel.pe/' }, origin: 'Lima', departures: [{ date: '2029-07-10', price: 1599 }, { date: '2029-08-10', price: 1699 }] }
  const batch = await createDepartures(payload, req, input)
  assert.equal(batch.created.length, 2)
  const shared = await payload.findByID({ collection: 'programs', id: batch.programId, req, overrideAccess: false })
  assert.equal(shared.mtpe, 'SHARED1'); assert.equal(shared.flyerSourceUrl, null); checks++
  for (const item of batch.created) {
    const doc = await payload.update({ collection: 'departures', id: item.id, req, overrideAccess: false, data: { status: 'published' } })
    assert.equal(doc.currency, 'USD'); assert.equal(doc.advanceDays, 30)
    assert.equal(publishedPackages([cmsToDeparture(doc)])[0].flyerUrl, DEFAULT_FLYER)
  }
  checks++
  await payload.update({ collection: 'programs', id: shared.id, req, overrideAccess: false, data: { program: 'Nombre actualizado', flyer: uploaded.id } })
  const dates = await payload.find({ collection: 'departures', req, overrideAccess: false, depth: 2, where: { programRef: { equals: shared.id } } })
  assert.ok(dates.docs.every(doc => cmsToDeparture(doc).program === 'Nombre actualizado' && cmsToDeparture(doc).flyerUrl.endsWith(uploaded.filename!)))
  const indexed = await payload.find({ collection: 'departures', req, overrideAccess: false, depth: 0, where: { program: { contains: 'actualizado' } } })
  assert.equal(indexed.totalDocs, 2); checks++
  const previewDoc = await payload.findByID({ collection: 'departures', id: batch.created[0].id, req, overrideAccess: false, depth: 1 })
  assert.equal(cmsToDeparture(previewDoc).destination, 'Cusco'); assert.ok(cmsToDeparture(previewDoc).flyerUrl.endsWith(uploaded.filename!)); checks++
  await assert.rejects(() => payload.update({ collection: 'programs', id: shared.id, req, overrideAccess: false, data: { bookingUrl: '' } })); checks++
  await assert.rejects(() => payload.create({ collection: 'programs', req, overrideAccess: false, data: { ...input.program, mtpe: 'shared1', destination: destination.id } })); checks++
  const countBefore = (await payload.count({ collection: 'departures', req, overrideAccess: true })).totalDocs
  await assert.rejects(() => createDepartures(payload, req, { programId: shared.id, origin: 'Lima', departures: [{ date: '2029-09-10', price: 1000 }, { date: '2029-07-10', price: 1000 }] }))
  assert.equal((await payload.count({ collection: 'departures', req, overrideAccess: true })).totalDocs, countBefore); checks++
  await assert.rejects(() => createDepartures(payload, req, { programId: shared.id, origin: 'Lima', departures: [{ date: '2029-09-10', price: 1000 }, { date: '2029-09-10', price: 1000 }] })); checks++
  await assert.rejects(() => createDepartures(payload, req, { programId: shared.id, origin: ' LIMA ', departures: [{ date: '2029-07-10', price: 1000 }] })); checks++
  const otherOrigin = await createDepartures(payload, req, { programId: shared.id, origin: 'Arequipa', departures: [{ date: '2029-07-10', price: 1299 }] })
  assert.equal(otherOrigin.created.length, 1); checks++
  const duplicated = await duplicateDepartures(payload, req, batch.created[0].id, [{ date: '2029-10-10', price: 1799 }])
  assert.equal(duplicated.programId, shared.id)
  assert.equal((await payload.findByID({ collection: 'departures', id: duplicated.created[0].id, req })).status, 'draft'); checks++
  const beforeFailure = { programs: (await payload.count({ collection: 'programs', req })).totalDocs, departures: (await payload.count({ collection: 'departures', req })).totalDocs, audit: (await payload.count({ collection: 'audit-log', req })).totalDocs, media: (await payload.count({ collection: 'media', req })).totalDocs }
  const forcedFailure = ({ data }: { data: Record<string, any> }) => { if (data.travelDate === '2029-12-11') throw new Error('Fallo de persistencia simulado'); return data }
  payload.collections.departures.config.hooks.beforeChange.push(forcedFailure)
  try { await assert.rejects(() => createDepartures(payload, req, { ...input, program: { ...input.program, mtpe: 'ROLLBACK', destination: 'Destino temporal' }, origin: 'Origen temporal', departures: [{ date: '2029-12-10', price: 1000 }, { date: '2029-12-11', price: 1000 }] }, new File([new Uint8Array(image)], 'rollback.png', { type: 'image/png' })), /Fallo de persistencia/) }
  finally { payload.collections.departures.config.hooks.beforeChange.pop() }
  assert.equal((await payload.count({ collection: 'programs', req })).totalDocs, beforeFailure.programs)
  assert.equal((await payload.count({ collection: 'departures', req })).totalDocs, beforeFailure.departures)
  assert.equal((await payload.count({ collection: 'audit-log', req })).totalDocs, beforeFailure.audit)
  assert.equal((await payload.count({ collection: 'media', req })).totalDocs, beforeFailure.media)
  assert.equal((await payload.count({ collection: 'destinations', req, where: { name: { equals: 'Destino temporal' } } })).totalDocs, 0); checks++
  const anonymous = await createLocalReq({}, payload)
  await assert.rejects(() => createDepartures(payload, anonymous, input)); checks++
  await assert.rejects(() => createDepartures(payload, req, { ...input, departures: [] }))
  await assert.rejects(() => createDepartures(payload, req, { ...input, departures: Array.from({ length: 31 }, (_, i) => ({ date: `2029-12-${String(i + 1).padStart(2, '0')}`, price: 100 })) })); checks++
  const thirty = await createDepartures(payload, req, { programId: shared.id, origin: 'Lima', departures: Array.from({ length: 30 }, (_, i) => ({ date: `2030-06-${String(i + 1).padStart(2, '0')}`, price: 1000 + i })) })
  assert.equal(thirty.created.length, 30); checks++
  const publicNow = new Date()
  const expired = await payload.db.create({ collection: 'departures', req, data: { program: 'Vencida pendiente', mtpe: 'LEGACY1', destination: destination.id, zone: 'Europa', origin: origin.id, days: 10, travelDate: '2020-01-01', advanceDays: 30, withdrawalAt: '2019-12-02T05:00:00.000Z', status: 'published', price: 1000, currency: 'USD', priceCondition: 'Por persona', stableId: randomUUID(), sourceKey: randomUUID(), createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', bookingUrl: 'https://www.megatravel.pe/es/', descriptionUrl: 'https://cafe.megatravel.pe/' } })
  const published = await payload.find({ collection: 'departures', req, where: departureViewWhere('published', publicNow), pagination: false })
  const withdrawn = await payload.find({ collection: 'departures', req, where: departureViewWhere('withdrawn', publicNow), pagination: false })
  assert.ok(!published.docs.some(d => d.id === expired.id)); assert.ok(withdrawn.docs.some(d => d.id === expired.id)); checks++
  const legacy = await payload.db.create({ collection: 'departures', req, data: { ...expired, id: undefined, stableId: randomUUID(), sourceKey: randomUUID(), program: 'Referencia vigente', travelDate: '2029-01-01', withdrawalAt: '2028-12-02T05:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' } })
  const beforeVersions = await payload.findVersions({ collection: 'departures', req, overrideAccess: true, pagination: false })
  const beforeAudit = await payload.find({ collection: 'audit-log', req, overrideAccess: true, pagination: false })
  const migration = await prepareProgramMigration(payload, req)
  assert.equal(migration.report.find(g => g.mtpe === 'LEGACY1')?.sourceId, legacy.id)
  const applied = await applyProgramMigration(payload, req, migration.backup)
  assert.equal(applied.createdPrograms.length, 1); assert.equal(applied.changes.length, 2)
  const migrated = await payload.findByID({ collection: 'departures', id: expired.id, req, depth: 0, context: { skipProgramResolution: true } })
  assert.equal(migrated.program, 'Referencia vigente'); assert.equal(migrated.price, expired.price); assert.equal(migrated.updatedAt, expired.updatedAt)
  assert.equal(migrated.status, expired.status); assert.equal(migrated.stableId, expired.stableId)
  assert.deepEqual((await payload.findVersions({ collection: 'departures', req, overrideAccess: true, pagination: false })).docs, beforeVersions.docs)
  assert.deepEqual((await payload.find({ collection: 'audit-log', req, overrideAccess: true, pagination: false })).docs, beforeAudit.docs); checks++
  const again = await prepareProgramMigration(payload, req)
  assert.equal((await applyProgramMigration(payload, req, again.backup)).changes.length, 0); checks++
  await revertProgramMigration(payload, req, migration.backup, applied)
  await revertProgramMigration(payload, req, migration.backup, applied)
  const restored = await payload.findByID({ collection: 'departures', id: expired.id, req, depth: 0, context: { skipProgramResolution: true } })
  assert.equal(restored.program, expired.program); assert.equal(restored.programRef, null); assert.equal(restored.updatedAt, expired.updatedAt); checks++
  const popup = await payload.create({ collection: 'banners', overrideAccess: true, data: { placement: 'popup', title: 'Novedades para agencias', message: 'Conoce nuestras próximas salidas.', alt: 'Noticia Megatravel', popupKind: 'news', enabled: true } })
  assert.equal(popup.image, null); assert.equal(popup.popupFrequency, 'session'); checks++
  await assert.rejects(payload.create({ collection: 'banners', overrideAccess: true, data: { placement: 'hero', alt: 'Banner sin imagen' } })); checks++
  await assert.rejects(payload.create({ collection: 'banners', overrideAccess: true, data: { placement: 'popup', alt: 'Noticia sin título' } })); checks++
  await assert.rejects(payload.update({ collection: 'banners', id: popup.id, overrideAccess: true, data: { href: 'javascript:alert(1)' } })); checks++
  await assert.rejects(payload.find({ collection: 'banners', overrideAccess: false }), (error: unknown) => (error as { status?: number }).status === 403); checks++
  console.log(`${checks} comprobaciones de integración correctas. Base aislada: ${process.env.SQLITE_URL}`)
} finally { await payload.destroy() }
