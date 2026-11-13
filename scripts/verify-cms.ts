// Integration verification in an isolated, disposable SQLite DB. Run after installing dependencies.
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
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
const { retireExpired } = await import('../src/server/retire-service')
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
  const autoCampaign = await payload.create({ collection: 'campaigns', req, overrideAccess: false, data: { name: 'Promoción sin identificador', label: 'Oferta' } as any })
  assert.match(autoCampaign.slug, /^promo-[a-f0-9-]+$/)
  const editedCampaign = await payload.update({ collection: 'campaigns', id: autoCampaign.id, req, overrideAccess: false, data: { name: 'Promoción actualizada' } })
  assert.equal(editedCampaign.slug, autoCampaign.slug); checks++
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#f90' } }).png().toBuffer()
  const uploaded = await payload.create({ collection: 'media', req, overrideAccess: false, data: { alt: 'Imagen de prueba de persistencia' }, file: { data: image, size: image.length, mimetype: 'image/png', name: 'persistence.png' } })
  assert.ok(uploaded.filename)
  assert.ok((await readFile(path.join(process.env.MEDIA_DIR, uploaded.filename))).length > 0); checks++
  const largeImage = await sharp({ create: { width: 2200, height: 1100, channels: 3, background: '#2468ab' } }).png().toBuffer()
  const optimizedImage = await payload.create({ collection: 'media', req, overrideAccess: false, data: { alt: 'Imagen optimizada' }, file: { data: largeImage, size: largeImage.length, mimetype: 'image/png', name: 'large.png' } })
  const savedImage = await readFile(path.join(process.env.MEDIA_DIR, optimizedImage.filename!))
  const savedMetadata = await sharp(savedImage).metadata()
  assert.equal(savedMetadata.format, 'webp'); assert.equal(savedMetadata.width, 1600); assert.equal(savedMetadata.height, 800)
  assert.ok(savedImage.length < largeImage.length); assert.equal(optimizedImage.mimeType, 'image/webp'); checks++
  const smallImage = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#f90' } }).png().toBuffer()
  const replacedImage = await payload.update({ collection: 'media', id: optimizedImage.id, req, overrideAccess: false, data: { alt: 'Imagen reemplazada' }, file: { data: smallImage, size: smallImage.length, mimetype: 'image/png', name: 'small.png' } })
  const replacedMetadata = await sharp(await readFile(path.join(process.env.MEDIA_DIR, replacedImage.filename!))).metadata()
  assert.equal(replacedMetadata.width, 400); assert.equal(replacedMetadata.height, 200); checks++
  const animation = Buffer.from('47494638396101000100800000000000ffffff21f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b', 'hex')
  const animatedImage = await payload.create({ collection: 'media', req, overrideAccess: false, data: { alt: 'Animación de prueba' }, file: { data: animation, size: animation.length, mimetype: 'image/gif', name: 'animated.gif' } })
  const animationMetadata = await sharp(await readFile(path.join(process.env.MEDIA_DIR, animatedImage.filename!)), { animated: true }).metadata()
  assert.equal(animationMetadata.format, 'gif'); assert.equal(animationMetadata.pages, 2); checks++
  const animatedWebp = await sharp(animation, { animated: true }).webp({ lossless: true }).toBuffer()
  const webpAnimation = await payload.create({ collection: 'media', req, overrideAccess: false, data: { alt: 'WebP animado de prueba' }, file: { data: animatedWebp, size: animatedWebp.length, mimetype: 'image/webp', name: 'animated.webp' } })
  assert.equal((await sharp(await readFile(path.join(process.env.MEDIA_DIR, webpAnimation.filename!)), { animated: true }).metadata()).pages, 2); checks++
  const jpeg = await sharp({ create: { width: 1800, height: 900, channels: 3, background: '#2468ab' } }).jpeg({ quality: 100 }).toBuffer()
  const optimizedJpeg = await payload.create({ collection: 'media', req, overrideAccess: false, data: { alt: 'JPEG optimizado' }, file: { data: jpeg, size: jpeg.length, mimetype: 'image/jpeg', name: 'original.jpg' } })
  assert.equal(optimizedJpeg.mimeType, 'image/webp'); assert.ok(optimizedJpeg.filesize! < jpeg.length); checks++
  await assert.rejects(() => payload.create({ collection: 'users', req, overrideAccess: false, data: { name: 'Prohibido', email: 'forbidden@example.test', password: randomUUID(), role: 'admin' } })); checks++
  await assert.rejects(() => payload.findGlobal({ slug: 'settings', req, overrideAccess: false })); checks++
  const destination = await payload.create({ collection: 'destinations', req, overrideAccess: false, data: { name: 'Madrid' } })
  const origin = await payload.create({ collection: 'origins', req, overrideAccess: false, data: { name: 'Lima' } })
  const date = new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10)
  const cronData = { program: 'Retiro de prueba', mtpe: 'CRON1', destination: destination.id, zone: 'Europa', origin: origin.id, days: 10, travelDate: date, price: 2000, currency: 'USD' as const, priceCondition: 'Por persona', bookingUrl: 'https://www.megatravel.pe/es/', descriptionUrl: 'https://cafe.megatravel.pe/', status: 'published' as const, advanceDays: 30 }
  const cronExpired = await payload.create({ collection: 'departures', req, overrideAccess: false, data: cronData })
  const cronCurrent = await payload.create({ collection: 'departures', req, overrideAccess: false, data: { ...cronData, program: 'Salida vigente', mtpe: 'CRON2' } })
  const cronDraft = await payload.create({ collection: 'departures', req, overrideAccess: false, data: { ...cronData, program: 'Borrador de prueba', mtpe: 'CRON3', status: 'draft' } })
  // Simula que pasó el tiempo sin eludir las validaciones en operaciones normales.
  for (const id of [cronExpired.id, cronDraft.id]) await payload.db.updateOne({ collection: 'departures', id, req, data: { travelDate: '2020-01-01', withdrawalAt: '2019-12-02T05:00:00.000Z' } })
  const cronReport = await retireExpired(payload)
  assert.equal(cronReport.checked, 2); assert.equal(cronReport.withdrawn, 1); assert.equal(cronReport.errors, 0, JSON.stringify(cronReport))
  const automaticallyWithdrawn = await payload.findByID({ collection: 'departures', id: cronExpired.id, req, depth: 0 })
  assert.equal(automaticallyWithdrawn.status, 'withdrawn'); assert.equal(automaticallyWithdrawn.withdrawalReason, 'automatic'); assert.equal(automaticallyWithdrawn.retiredBy, null)
  assert.equal((await payload.findByID({ collection: 'departures', id: cronCurrent.id, req })).status, 'published')
  assert.equal((await payload.findByID({ collection: 'departures', id: cronDraft.id, req })).status, 'draft')
  const cronAudit = await payload.find({ collection: 'audit-log', req, where: { departureId: { equals: cronExpired.stableId } }, pagination: false })
  assert.equal(cronAudit.docs.filter(log => log.event === 'withdrawn' && log.actorLabel === 'Sistema: retiro automático').length, 1)
  const repeatCron = await retireExpired(payload)
  assert.equal(repeatCron.withdrawn, 0); assert.equal(repeatCron.errors, 0); checks++
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
  // El programa conserva valores iniciales; cada salida posee su saldo.
  const seatProgramID = typeof departure.programRef === 'object' ? departure.programRef!.id : departure.programRef!
  const seatStart = Date.now()
  let pool = await payload.update({ collection: 'programs', id: seatProgramID, req, overrideAccess: false, data: { availableSeats: 15 } })
  const seatStamp = pool.seatsCheckedAt
  assert.ok(Date.parse(seatStamp!) >= seatStart); checks++
  let withSeats = await payload.findByID({ collection: 'departures', id: departure.id, req, depth: 0 })
  assert.equal(withSeats.availableSeats, null)
  await payload.update({ collection: 'departures', id: departure.id, req, overrideAccess: false, data: { availableSeats: 99 } })
  assert.equal((await payload.findByID({ collection: 'programs', id: seatProgramID, req })).availableSeats, 15); checks++
  withSeats = await payload.update({ collection: 'departures', id: departure.id, req, data: { lastSeats: true } })
  assert.equal(cmsToDeparture(withSeats).availableSeats, 99)
  assert.ok(publishedPackages([cmsToDeparture(withSeats)])[0].availability?.lastSeats)
  assert.equal((await payload.findByID({ collection: 'programs', id: seatProgramID, req })).lastSeats, false); checks++
  await payload.update({ collection: 'departures', id: departure.id, req, data: { price: 4000, seatsConfirmed: true } })
  assert.equal((await payload.findByID({ collection: 'programs', id: seatProgramID, req })).seatsCheckedAt, seatStamp); checks++
  pool = await payload.update({ collection: 'programs', id: seatProgramID, req, data: { seatsCheckedAt: '2099-01-01T00:00:00Z' } })
  assert.equal(pool.seatsCheckedAt, seatStamp); checks++
  for (const availableSeats of [-1, 1.5]) await assert.rejects(() => payload.update({ collection: 'programs', id: seatProgramID, req, data: { availableSeats } }))
  checks++
  pool = await payload.update({ collection: 'programs', id: seatProgramID, req, data: { availableSeats: 0, lastSeats: true } })
  assert.equal(pool.lastSeats, false)
  withSeats = await payload.findByID({ collection: 'departures', id: departure.id, req })
  assert.equal(publishedPackages([cmsToDeparture(withSeats)])[0].availability?.seats, 99); checks++
  await payload.update({ collection: 'programs', id: seatProgramID, req, data: { availableSeats: null } })
  withSeats = await payload.findByID({ collection: 'departures', id: departure.id, req })
  assert.equal(publishedPackages([cmsToDeparture(withSeats)])[0].availability?.lastSeats, true); checks++
  const nextDate = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)
  await payload.update({ collection: 'programs', id: seatProgramID, req, data: { availableSeats: 12 } })
  withSeats = await payload.update({ collection: 'departures', id: departure.id, req, data: { travelDate: nextDate } })
  assert.equal(withSeats.availableSeats, null); checks++
  const importProgramID = typeof imported.docs[0].programRef === 'object' ? imported.docs[0].programRef!.id : imported.docs[0].programRef!
  const importedPool = await payload.update({ collection: 'departures', id: imported.docs[0].id, req, data: { availableSeats: 4, lastSeats: true } })
  await importCSV(payload, csv, req, { dryRun: false, downloadImages: false })
  const importAfter = await payload.findByID({ collection: 'departures', id: imported.docs[0].id, req })
  assert.equal(importAfter.availableSeats, 4); assert.equal(importAfter.lastSeats, true); assert.equal(importAfter.seatsCheckedAt, importedPool.seatsCheckedAt); checks++
  await payload.db.updateOne({ collection: 'departures', id: imported.docs[0].id, req, data: { seatsCheckedAt: new Date(Date.now() - 25 * 3600000).toISOString() } })
  await payload.update({ collection: 'programs', id: importProgramID, req, data: { program: 'Programa importado revisado' } })
  const seatNow = new Date()
  await payload.update({ collection: 'departures', id: imported.docs[0].id, req, data: { status: 'published' } })
  assert.ok((await payload.find({ collection: 'departures', req, where: departureViewWhere('seats-review', seatNow, 24), pagination: false })).docs.some(doc => doc.id === imported.docs[0].id))
  assert.ok(!(await payload.find({ collection: 'departures', req, where: departureViewWhere('seats-review', seatNow, 72), pagination: false })).docs.some(doc => doc.id === imported.docs[0].id)); checks++
  const { getSeatSettings } = await import('../src/server/availability-settings')
  await payload.updateGlobal({ slug: 'settings', req: adminReq, overrideAccess: false, data: { seatsValidityHours: 24 } })
  assert.equal((await getSeatSettings(payload, req)).validityHours, 24)
  await assert.rejects(() => payload.updateGlobal({ slug: 'settings', req, overrideAccess: false, data: { seatsValidityHours: 48 } }))
  await payload.updateGlobal({ slug: 'settings', req: adminReq, overrideAccess: false, data: { seatsValidityHours: 72 } }); checks++
  const dry = await importCSV(payload, csv.replace('import-test', 'dry-run-test').replace(date, '2029-06-10'), req, { dryRun: true, downloadImages: false })
  assert.equal(dry.errors, 0)
  assert.equal((await payload.count({ collection: 'departures', overrideAccess: true, where: { sourceKey: { equals: 'dry-run-test' } } })).totalDocs, 0); checks++
  await assert.rejects(() => payload.find({ collection: 'programs', overrideAccess: false })); checks++
  const input = { seatsConfirmed: true, program: { program: 'Programa compartido', mtpe: ' shared1 ', destination: 'Cusco', zone: 'Perú', days: 5, nights: 4, availableSeats: 15, seatsConfirmed: true, bookingUrl: 'https://www.megatravel.pe/es/', descriptionUrl: 'https://cafe.megatravel.pe/' }, origin: 'Lima', departures: [{ date: '2029-07-10', price: 1599, lastSeats: false }, { date: '2029-08-10', price: 1699, lastSeats: true }] }
  const imageCount = (await payload.count({ collection: 'media', req })).totalDocs
  const withExistingImage = await createDepartures(payload, req, { ...input, program: { ...input.program, mtpe: 'EXISTINGIMG', flyer: uploaded.id }, departures: [{ date: '2036-01-10', price: 1500 }] })
  const imageProgram = await payload.findByID({ collection: 'programs', id: withExistingImage.programId, req, depth: 0 })
  assert.equal(imageProgram.flyer, uploaded.id)
  assert.equal((await payload.count({ collection: 'media', req })).totalDocs, imageCount)
  await assert.rejects(() => createDepartures(payload, req, { ...input, program: { ...input.program, mtpe: 'MISSINGIMG', flyer: 999999999 }, departures: [{ date: '2036-02-10', price: 1500 }] }), /imagen seleccionada/); checks++
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
  for (const videoUrl of ['https://www.youtube.com/watch?v=abc', 'https://www.instagram.com/reel/example/']) {
    await payload.update({ collection: 'programs', id: shared.id, req, overrideAccess: false, data: { videoUrl } })
    for (const depth of [0, 2]) {
      const videoDates = await payload.find({ collection: 'departures', req, overrideAccess: false, depth, where: { programRef: { equals: shared.id } } })
      assert.equal(videoDates.totalDocs, 2)
      assert.ok(videoDates.docs.every(doc => publishedPackages([cmsToDeparture(doc)])[0].videoUrl === videoUrl))
    }
  }
  await assert.rejects(() => payload.update({ collection: 'programs', id: shared.id, req, overrideAccess: false, data: { videoUrl: 'javascript:alert(1)' } }))
  await assert.rejects(() => payload.update({ collection: 'programs', id: shared.id, req, overrideAccess: false, data: { videoUrl: 'http://example.com/video' } }))
  await payload.update({ collection: 'programs', id: shared.id, req, overrideAccess: false, data: { videoUrl: null } })
  const withoutVideo = await payload.find({ collection: 'departures', req, overrideAccess: false, depth: 2, where: { programRef: { equals: shared.id } } })
  assert.ok(withoutVideo.docs.every(doc => publishedPackages([cmsToDeparture(doc)])[0].videoUrl === null)); checks++
  await payload.update({ collection: 'departures', id: batch.created[1].id, req, overrideAccess: false, data: { destinationOverride: destination.id, bookingUrlOverride: 'https://example.com/reserva-fecha' } })
  await payload.update({ collection: 'programs', id: shared.id, req, overrideAccess: false, data: { bookingUrl: 'https://example.com/reserva-compartida' } })
  const specificDate = cmsToDeparture(await payload.findByID({ collection: 'departures', id: batch.created[1].id, req, depth: 2 }))
  const commonDate = cmsToDeparture(await payload.findByID({ collection: 'departures', id: batch.created[0].id, req, depth: 2 }))
  assert.equal(specificDate.destination, 'Madrid'); assert.equal(specificDate.bookingUrl, 'https://example.com/reserva-fecha')
  assert.equal(commonDate.destination, 'Cusco'); assert.equal(commonDate.bookingUrl, 'https://example.com/reserva-compartida'); checks++
  await payload.update({ collection: 'departures', id: batch.created[1].id, req, overrideAccess: false, data: { destinationOverride: null, bookingUrlOverride: null } })
  const resetDate = cmsToDeparture(await payload.findByID({ collection: 'departures', id: batch.created[1].id, req, depth: 2 }))
  assert.equal(resetDate.destination, 'Cusco'); assert.equal(resetDate.bookingUrl, 'https://example.com/reserva-compartida'); checks++
  assert.equal(dates.docs.find(doc => doc.id === batch.created[0].id)?.availableSeats, 15)
  assert.equal(dates.docs.find(doc => doc.id === batch.created[1].id)?.availableSeats, 15)
  assert.equal(dates.docs.find(doc => doc.id === batch.created[1].id)?.lastSeats, true); checks++
  await payload.update({ collection: 'programs', id: shared.id, req, data: { availableSeats: 12, lastSeats: true } })
  let sharedDates = await payload.find({ collection: 'departures', req, depth: 0, where: { programRef: { equals: shared.id } }, pagination: false })
  assert.ok(sharedDates.docs.every(doc => doc.availableSeats === 15)); assert.equal(sharedDates.docs.find(doc => doc.id === batch.created[0].id)?.lastSeats, false); checks++
  await payload.update({ collection: 'programs', id: shared.id, req, data: { availableSeats: 15, lastSeats: false } })
  sharedDates = await payload.find({ collection: 'departures', req, depth: 0, where: { programRef: { equals: shared.id } }, pagination: false })
  assert.equal(sharedDates.docs.find(doc => doc.id === batch.created[0].id)?.lastSeats, false)
  assert.equal(sharedDates.docs.find(doc => doc.id === batch.created[1].id)?.lastSeats, true); checks++
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
  const promoA = await payload.create({ collection: 'campaigns', req, overrideAccess: false, data: { name: 'Promoción por fecha A', slug: 'promo-fecha-a', label: 'Oferta A' } })
  const promoB = await payload.create({ collection: 'campaigns', req, overrideAccess: false, data: { name: 'Promoción por fecha B', slug: 'promo-fecha-b', label: 'Oferta B' } })
  const byDate = await createDepartures(payload, req, { programId: shared.id, origin: 'Lima', departures: [
    { date: '2032-01-10', price: 1500, promotions: [String(promoA.id)] },
    { date: '2032-02-10', price: 1500, promotions: [promoB.id] },
    { date: '2032-03-10', price: 1500, promotions: [] },
  ] })
  const byDateDocs = await Promise.all(byDate.created.map(item => payload.findByID({ collection: 'departures', id: item.id, req, depth: 0 })))
  assert.deepEqual(byDateDocs.map(item => item.promotions), [[promoA.id], [promoB.id], []]); checks++
  const dateOverrides = await duplicateDepartures(payload, req, byDate.created[0].id, [
    { date: '2032-04-10', price: 1500, promotions: [promoB.id] },
    { date: '2032-05-10', price: 1500, promotions: [] },
    { date: '2032-06-10', price: 1500 },
  ])
  const duplicateDocs = await Promise.all(dateOverrides.created.map(item => payload.findByID({ collection: 'departures', id: item.id, req, depth: 0 })))
  assert.deepEqual(duplicateDocs.map(item => item.promotions), [[promoB.id], [], [promoA.id]]); checks++
  await assert.rejects(() => createDepartures(payload, req, { programId: shared.id, origin: 'Lima', departures: [{ date: '2032-07-10', price: 1500, promotions: [999999999] }] }), /promoción seleccionada/); checks++
  const duplicated = await duplicateDepartures(payload, req, batch.created[0].id, [{ date: '2029-10-10', price: 1799 }])
  assert.equal(duplicated.programId, shared.id)
  assert.equal((await payload.findByID({ collection: 'departures', id: duplicated.created[0].id, req })).status, 'draft'); checks++
  const publishedDates = await duplicateDepartures(payload, req, batch.created[0].id, [{ date: '2036-03-10', price: 1799 }, { date: '2036-04-10', price: 1899 }], false, 'published')
  assert.ok((await Promise.all(publishedDates.created.map(item => payload.findByID({ collection: 'departures', id: item.id, req })))).every(doc => doc.status === 'published'))
  const beforeBadDuplicate = (await payload.count({ collection: 'departures', req })).totalDocs
  await assert.rejects(() => duplicateDepartures(payload, req, batch.created[0].id, [{ date: '2036-05-10', price: 1799 }, { date: '2020-01-10', price: 1799 }], false, 'published'))
  assert.equal((await payload.count({ collection: 'departures', req })).totalDocs, beforeBadDuplicate); checks++
  const duplicateSeats = await payload.findByID({ collection: 'departures', id: duplicated.created[0].id, req })
  assert.equal(duplicateSeats.availableSeats, 15); assert.equal(duplicateSeats.lastSeats, false); assert.ok(duplicateSeats.seatsCheckedAt); checks++
  await assert.rejects(() => duplicateDepartures(payload, req, batch.created[0].id, [{ date: '2029-11-10', price: 1799, lastSeats: true }]), /Confirma/)
  const duplicateWithSeats = await duplicateDepartures(payload, req, batch.created[0].id, [{ date: '2029-11-10', price: 1799, lastSeats: true }], true)
  const confirmedSeats = await payload.findByID({ collection: 'departures', id: duplicateWithSeats.created[0].id, req })
  assert.equal(confirmedSeats.availableSeats, 15); assert.equal(confirmedSeats.lastSeats, true); assert.ok(confirmedSeats.seatsCheckedAt); checks++
  const direct = await createDepartures(payload, req, { status: 'published', programId: shared.id, origin: 'Lima', departures: [{ date: '2031-02-10', price: 1700 }] })
  assert.equal((await payload.findByID({ collection: 'departures', id: direct.created[0].id, req })).status, 'published')
  const toDelete = await createDepartures(payload, req, { programId: shared.id, origin: 'Lima', departures: [{ date: '2035-01-10', price: 1700 }] })
  const deletingDoc = await payload.findByID({ collection: 'departures', id: toDelete.created[0].id, req, depth: 0 })
  await assert.rejects(() => payload.delete({ collection: 'departures', id: deletingDoc.id, req, overrideAccess: false }))
  await payload.delete({ collection: 'departures', id: direct.created[0].id, req: adminReq, overrideAccess: false })
  await payload.delete({ collection: 'departures', id: deletingDoc.id, req: adminReq, overrideAccess: false })
  const deletedLogs = await payload.find({ collection: 'audit-log', req, overrideAccess: false, where: { departureId: { equals: deletingDoc.stableId } }, depth: 0 })
  assert.ok(deletedLogs.docs.some(log => String(log.event) === 'deleted' && log.actorLabel === admin.email)); checks++
  const beforeInvalidPublication = (await payload.count({ collection: 'departures', req })).totalDocs
  await assert.rejects(() => createDepartures(payload, req, { status: 'published', programId: shared.id, origin: 'Lima', departures: [{ date: '2031-03-10', price: 1700 }, { date: '2020-01-10', price: 1700 }] }))
  assert.equal((await payload.count({ collection: 'departures', req })).totalDocs, beforeInvalidPublication); checks++
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
  // Featured slots persist through background blog updates and clear on deletion.
  const { refreshMegaTravelBlogNow, syncMegaTravelBlog } = await import('../src/server/blog-service')
  const featuredSettings = await payload.updateGlobal({ slug: 'settings', req: adminReq, overrideAccess: false, data: { featuredDeparture1: cronCurrent.id, featuredDeparture2: cronDraft.id } })
  assert.equal(featuredSettings.featuredDeparture1 && typeof featuredSettings.featuredDeparture1 === 'object' ? featuredSettings.featuredDeparture1.id : featuredSettings.featuredDeparture1, cronCurrent.id); checks++
  await assert.rejects(payload.updateGlobal({ slug: 'settings', req: adminReq, overrideAccess: false, data: { featuredDeparture2: cronCurrent.id } }), (error: unknown) => JSON.stringify((error as { data?: unknown }).data).includes('distinta')); checks++
  await assert.rejects(payload.updateGlobal({ slug: 'settings', req, overrideAccess: false, data: { featuredDeparture1: null } })); checks++
  const blogHTML = Array.from({ length: 6 }, (_, i) => `<a href="/es/blog/post/${9000 + i}/prueba"><img src="https://tr2storage.blob.core.windows.net/headerimages/test-${i}.png"><span>DESTINOS</span><h3>Artículo ${i}</h3>${i < 4 ? '<span>12 nov, 2026</span>' : ''}</a>`).join('')
  const syncResult = await syncMegaTravelBlog(payload, { force: true, fetcher: async (url) => new Response(String(url).endsWith('/es/blog') ? blogHTML : new Uint8Array(image)) })
  assert.deepEqual(syncResult, { status: 'updated', posts: 6 }); checks++
  const blogSettings = await payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 1 })
  assert.equal(blogSettings.blogPosts?.length, 6)
  assert.ok(blogSettings.blogPosts?.every(post => post.image && typeof post.image === 'object' && post.image.mimeType === 'image/webp' && !!post.image.url))
  assert.equal(blogSettings.featuredDeparture1, cronCurrent.id); checks++
  const beforeCached = await payload.count({ collection: 'media', overrideAccess: true })
  assert.equal((await syncMegaTravelBlog(payload, { force: true, fetcher: async (url) => { assert.ok(String(url).endsWith('/es/blog')); return new Response(blogHTML) } })).status, 'updated')
  assert.equal((await payload.count({ collection: 'media', overrideAccess: true })).totalDocs, beforeCached.totalDocs); checks++
  await assert.rejects(() => refreshMegaTravelBlogNow(payload, req), (error: unknown) => (error as { status?: number }).status === 403); checks++
  const manualBlog = await refreshMegaTravelBlogNow(payload, adminReq, { fetcher: async (url) => { assert.ok(String(url).endsWith('/es/blog')); return new Response(blogHTML) } })
  assert.equal(manualBlog.posts, 6)
  assert.equal(manualBlog.settings.featuredDeparture1, cronCurrent.id)
  assert.equal(manualBlog.settings.featuredDeparture2, cronDraft.id)
  assert.equal(manualBlog.settings.blogPosts?.length, 6); checks++
  await payload.delete({ collection: 'departures', id: cronDraft.id, req: adminReq, overrideAccess: false })
  assert.equal((await payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 0 })).featuredDeparture2, null); checks++
  await payload.updateGlobal({ slug: 'settings', req: adminReq, overrideAccess: false, data: { featuredDeparture1: null } })
  assert.equal((await payload.findGlobal({ slug: 'settings', overrideAccess: true, depth: 0 })).featuredDeparture1, null); checks++
  console.log(`${checks} comprobaciones de integración correctas. Base aislada: ${process.env.SQLITE_URL}`)
} finally { await payload.destroy() }
