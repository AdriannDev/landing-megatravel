import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
process.env.USE_SQLITE = 'true'
Object.assign(process.env, { NODE_ENV: 'test' })
process.env.PAYLOAD_SECRET = randomUUID() + randomUUID()
process.env.SQLITE_URL = 'file:./.qa/departure-seats-' + randomUUID() + '.db'
process.env.R2_BUCKET = ''
await mkdir('.qa', { recursive: true })
const [{ getPayload, createLocalReq }, { default: config }, { createDepartures, duplicateDepartures }, { processPilotMail, createPilotPool }, { assignSeats }, { importCSV }, { cmsToDeparture }, { publicAvailability }] = await Promise.all([
  import('payload'), import('../src/payload.config'), import('../src/server/departure-service'), import('../src/server/mail-pilot-service'), import('../src/server/seat-assignment'), import('../src/server/import-service'), import('../src/server/normalize'), import('../src/lib/availability'),
])
const payload = await getPayload({ config })
let checks = 0
try {
  const admin = await payload.create({ collection: 'users', overrideAccess: true, context: { bootstrap: true }, data: { name: 'QA cupos', email: 'departure-seats@example.test', password: randomUUID(), role: 'admin' } })
  const req = await createLocalReq({ user: { ...admin, collection: 'users' } }, payload)
  const editor = await payload.create({ collection: 'users', req, data: { name: 'Editor', email: 'seats-editor@example.test', password: randomUUID(), role: 'editor' } })
  const editorReq = await createLocalReq({ user: { ...editor, collection: 'users' } }, payload)
  const fresh = () => createLocalReq({ user: { ...admin, collection: 'users' } }, payload)
  const program = await createDepartures(payload, req, { program: { program: 'Cupos independientes', mtpe: 'MTPE-50026', destination: 'Madrid', zone: 'Europa', days: 8, availableSeats: 15, lastSeats: true, seatsConfirmed: true }, origin: 'Lima', departures: [{ date: '2035-06-21', price: 2000 }, { date: '2035-07-21', price: 2100 }, { date: '2035-06-21', origin: 'Arequipa', price: 2200 }] })
  const [june, july, other] = program.created.map(d => d.id)
  const read = (id: number | string) => payload.findByID({ collection: 'departures', id, req, depth: 1 })
  const balance = async (id: number | string) => (await read(id)).availableSeats
  const reconcile = async (id: number | string, quantity: number, stamp = '2026-11-01T00:00:00.000Z') => {
    await payload.update({ collection: 'departures', id, req, data: { availableSeats: quantity, seatsConfirmed: true } })
    await payload.db.updateOne({ collection: 'departures', id, req, data: { seatsReconciledAt: stamp } })
  }
  for (const id of [june, july, other]) { assert.equal(await balance(id), 15); assert.equal((await read(id)).lastSeats, true); await reconcile(id, 15) }
  const julyReview = (await read(july)).seatsCheckedAt
  const mail = async (id: string, patch: Record<string, string> = {}, live = true) => processPilotMail(await fresh(), { id, mailbox: 'independent-test', trusted: true, receivedAt: '2026-11-13T12:00:00Z', body: Object.entries({ MTPE: 'MTPE-50026', Reserva: 'MTP-0012345', Salida: '2035-06-21', Origen: 'Lima', Sillas: '3', Estado: 'Reserva', ...patch }).map(([k, v]) => `${k}: ${v}`).join('\n') }, live ? { cutoffAt: '2026-11-01T00:00:00Z', mtpes: [] } : undefined)
  const first = await mail('first')
  assert.equal(first.delta, -3); assert.deepEqual(await Promise.all([june, july, other].map(balance)), [12, 15, 15]); assert.equal((await read(july)).seatsCheckedAt, julyReview); checks++
  await payload.update({ collection: 'programs', id: program.programId, req, data: { availableSeats: 25, lastSeats: false } })
  assert.deepEqual(await Promise.all([june, july, other].map(balance)), [12, 15, 15]); assert.equal((await read(june)).lastSeats, true)
  const duplicate = await duplicateDepartures(payload, req, june, [{ date: '2035-08-21', price: 2300 }]); assert.equal(await balance(duplicate.created[0].id), 25); assert.equal((await read(duplicate.created[0].id)).lastSeats, false); checks++
  assert.equal((await mail('same', { Reserva: '0012345' })).delta, 0); assert.equal(await balance(june), 12)
  assert.equal((await mail('quantity', { Sillas: '5' })).delta, -2); assert.equal(await balance(june), 10)
  assert.equal((await mail('ambiguous-origin', { Reserva: 'MTP-999', Origen: '' })).outcome, 'review')
  assert.equal((await mail('missing-date', { Reserva: 'MTP-999', Salida: '' })).outcome, 'review'); checks++
  const moved = await mail('transfer', { Salida: '2035-07-21', Sillas: '4' })
  assert.equal(moved.outcome, 'proposed'); assert.equal((moved.movements as any[]).length, 2)
  assert.deepEqual(await Promise.all([june, july, other].map(balance)), [15, 11, 15]); checks++
  assert.equal((await mail('wrong-cancel', { Estado: 'Cancelado', Sillas: '4' })).outcome, 'review')
  assert.deepEqual(await Promise.all([june, july].map(balance)), [15, 11])
  assert.equal((await mail('cancel', { Salida: '2035-07-21', Estado: 'Cancelado', Sillas: '4' })).delta, 4)
  assert.equal((await mail('cancel-again', { Salida: '2035-07-21', Estado: 'Anulado', Sillas: '4' })).delta, 0); checks++
  await mail('reactivate', { Sillas: '3' })
  await reconcile(july, 1)
  assert.equal((await mail('insufficient-transfer', { Salida: '2035-07-21', Sillas: '3' })).outcome, 'review')
  assert.deepEqual(await Promise.all([june, july].map(balance)), [12, 1]); checks++
  await reconcile(july, 15)
  const stateBefore = await payload.find({ collection: 'seat-pilot-reservations', req, pagination: false })
  const auditBefore = (await payload.count({ collection: 'audit-log', req })).totalDocs
  payload.collections['seat-mail-events'].config.hooks.beforeChange.push(() => { throw new Error('Deliberate transfer failure') })
  try { await assert.rejects(mail('transfer-failure', { Salida: '2035-07-21' }), /Deliberate/) }
  finally { payload.collections['seat-mail-events'].config.hooks.beforeChange.pop() }
  assert.deepEqual(await Promise.all([june, july].map(balance)), [12, 15])
  assert.deepEqual((await payload.find({ collection: 'seat-pilot-reservations', req, pagination: false })).docs, stateBefore.docs)
  assert.equal((await payload.count({ collection: 'audit-log', req })).totalDocs, auditBefore); checks++
  const originTransfer = await mail('origin-transfer', { Origen: 'Arequipa' }); assert.equal(originTransfer.outcome, 'proposed')
  assert.deepEqual(await Promise.all([june, other].map(balance)), [15, 12]); checks++
  const preview = await assignSeats(editorReq, { action: 'preview', ids: [june, july], availableSeats: 10 })
  assert.equal(preview.rows!.length, 2)
  const beforeKnown = (await payload.find({ collection: 'seat-pilot-reservations', req, pagination: false })).totalDocs
  await assignSeats(editorReq, { action: 'apply', ids: [june, july], availableSeats: 10, confirmation: preview as any })
  assert.deepEqual(await Promise.all([june, july, other].map(balance)), [10, 10, 12])
  assert.equal((await payload.find({ collection: 'seat-pilot-reservations', req, pagination: false })).totalDocs, beforeKnown); checks++
  const rollbackPreview = await assignSeats(req, { action: 'preview', ids: [june, july], availableSeats: 8 })
  const failSecond = ({ originalDoc }: { originalDoc?: { id?: number | string } }) => { if (originalDoc?.id === july) throw new Error('Deliberate assignment failure') }
  payload.collections.departures.config.hooks.beforeChange.push(failSecond)
  try { await assert.rejects(assignSeats(req, { action: 'apply', ids: [june, july], availableSeats: 8, confirmation: rollbackPreview as any }), /Deliberate/) }
  finally { payload.collections.departures.config.hooks.beforeChange.pop() }
  assert.deepEqual(await Promise.all([june, july].map(balance)), [10, 10]); checks++
  const stale = await assignSeats(req, { action: 'preview', ids: [other], availableSeats: 20 })
  await mail('intervening-mail', { Reserva: 'MTP-888', Origen: 'Arequipa', Sillas: '1' })
  await assert.rejects(assignSeats(req, { action: 'apply', ids: [other], availableSeats: 20, confirmation: stale as any }), /cambiaron/); checks++
  const cutoffBeforeFlag = (await read(other)).seatsReconciledAt
  const flagPreview = await assignSeats(req, { action: 'preview', programId: program.programId, lastSeats: false })
  await assignSeats(req, { action: 'apply', programId: program.programId, lastSeats: false, confirmation: flagPreview as any })
  assert.equal((await read(other)).seatsReconciledAt, cutoffBeforeFlag); assert.equal((await read(other)).lastSeats, false); checks++
  // Old mail must not discount sales already included in a newly loaded availability.
  assert.equal((await mail('before-reconciliation', { Reserva: 'MTP-777', Sillas: '2' })).outcome, 'review')
  assert.equal(await balance(june), 10)
  await reconcile(other, 7, '2026-11-12T00:00:00Z')
  assert.equal((await mail('known-cancel-after-reconciliation', { Origen: 'Arequipa', Estado: 'Cancelado', Sillas: '3' })).delta, 3)
  assert.equal(await balance(other), 10); checks++
  // CSV: empty/absent preserves, zero is explicit, flags can vary per departure.
  const csv = 'source_key,program,mtpe,destination,zone,origin,days,travel_date,price,status,available_seats,last_seats\nseats-csv-1,CSV cupos,CSV-SEATS,Madrid,Europa,Lima,8,2035-09-01,2200,draft,0,true\nseats-csv-2,CSV cupos,CSV-SEATS,Madrid,Europa,Lima,8,2035-10-01,2200,draft,9,true'
  const validate = async (content: string) => importCSV(payload, content, req, { dryRun: true, downloadImages: false })
  const apply = async (content: string, validation: Awaited<ReturnType<typeof validate>>, confirmed = true) => importCSV(payload, content, req, { dryRun: false, downloadImages: false, seatsConfirmed: confirmed, validationTokens: Object.fromEntries(validation.results.map(r => [String(r.row), r.validationToken!])) })
  const validation = await validate(csv); assert.equal(validation.errors, 0); assert.deepEqual(validation.results.map(r => [r.availableSeats, r.lastSeats]), [[0, false], [9, true]])
  assert.equal((await apply(csv, validation, false)).errors, 2)
  const imported = await apply(csv, validation); assert.equal(imported.errors, 0, JSON.stringify(imported))
  const csvId = imported.results[1].id!
  const stamp = (await read(csvId)).seatsCheckedAt
  const csvEmpty = csv.replace(',0,true', ',,').replace(',9,true', ',,')
  assert.equal((await importCSV(payload, csvEmpty, req, { dryRun: false, downloadImages: false })).errors, 0)
  assert.equal(await balance(csvId), 9); assert.equal((await read(csvId)).seatsCheckedAt, stamp); checks++
  const updateCsv = csv.replace(',9,true', ',12,false')
  const updatePreview = await validate(updateCsv)
  await payload.update({ collection: 'departures', id: csvId, req, data: { availableSeats: 8 } })
  assert.equal((await apply(updateCsv, updatePreview)).errors, 2); assert.equal(await balance(csvId), 8)
  assert.equal((await apply(updateCsv, await validate(updateCsv))).errors, 0); assert.equal(await balance(csvId), 12); checks++
  // Simulation isolates every departure and follows transfer rules.
  const poolJune = await createPilotPool(req, { mtpe: '50026', travelDate: '2035-06-21', origin: 'Lima', initialSeats: 15, cutoffAt: '2026-11-01T00:00:00Z' })
  const poolJuly = await createPilotPool(req, { mtpe: '50026', travelDate: '2035-07-21', initialSeats: 15, cutoffAt: '2026-11-01T00:00:00Z' })
  assert.equal((await mail('simulation-first', {}, false)).outcome, 'proposed')
  const simulatedBalance = async (id: number) => (await payload.findByID({ collection: 'seat-pilot-pools', id, req })).remainingSeats
  assert.deepEqual(await Promise.all([poolJune.id, poolJuly.id].map(simulatedBalance)), [12, 15])
  assert.equal((await mail('simulation-transfer', { Salida: '2035-07-21' }, false)).outcome, 'proposed')
  assert.deepEqual(await Promise.all([poolJune.id, poolJuly.id].map(simulatedBalance)), [15, 12]); assert.equal(await balance(june), 10); checks++
  const publicJune = publicAvailability(cmsToDeparture(await read(june)))
  assert.equal(publicJune?.seats, 10); assert.equal(publicJune?.lastSeats, false)
  await payload.update({ collection: 'departures', id: june, req, data: { availableSeats: 0, lastSeats: true } })
  assert.equal(publicAvailability(cmsToDeparture(await read(june))), null); checks++
  // Recreated rows/programs never inherit reservation history through matching MTPE/date.
  const { deletionPreview, deleteSelection } = await import('../src/server/deletion-service')
  await deleteSelection(req, 'departures', [other], await deletionPreview(req, 'departures', [other]))
  const recreated = await createDepartures(payload, req, { programId: program.programId, origin: 'Arequipa', departures: [{ date: '2035-06-21', price: 2200 }] })
  await reconcile(recreated.created[0].id, 15)
  assert.equal((await mail('recreated-departure', { Origen: 'Arequipa' })).outcome, 'review')
  assert.equal(await balance(recreated.created[0].id), 15)
  await deleteSelection(req, 'programs', [program.programId], await deletionPreview(req, 'programs', [program.programId]))
  const replacement = await createDepartures(payload, req, { program: { program: 'Programa recreado', mtpe: 'MTPE-50026', destination: 'Madrid', zone: 'Europa', days: 8, availableSeats: 15, seatsConfirmed: true }, origin: 'Lima', departures: [{ date: '2035-06-21', price: 2000 }] })
  await reconcile(replacement.created[0].id, 15)
  assert.equal((await mail('recreated-program')).outcome, 'review')
  assert.equal(await balance(replacement.created[0].id), 15); checks++
  console.log(`${checks} grupos de comprobaciones de cupos por fecha/origen, correo real/simulado, traslados, conciliación, CSV, concurrencia y reversión correctos.`)
} finally { await payload.destroy() }
