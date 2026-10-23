import test from 'node:test'
import assert from 'node:assert/strict'
import { importCSV } from '../src/server/import-service.ts'

function persistence() {
  const tables = new Map(); let sequence = 0
  const table = name => { if (!tables.has(name)) tables.set(name, []); return tables.get(name) }
  return {
    tables,
    async find({ collection, where }) {
      const docs = table(collection).filter(doc => Object.entries(where || {}).every(([key, filter]) => doc[key] === filter.equals))
      return { docs, totalDocs: docs.length }
    },
    async create({ collection, data }) { const doc = { ...data, id: String(++sequence) }; table(collection).push(doc); return doc },
    async update({ collection, id, data }) { const doc = table(collection).find(doc => doc.id === id); assert.ok(doc); Object.assign(doc, data); return doc },
  }
}
const csv = 'source_key,program,mtpe,destination,zone,origin,days,travel_date,price,currency,flyer_url,booking_url,description_url,status\nid1,Europa,10035,Madrid,Europa,Lima,10,2028-10-10,3599,USD,https://i.imgur.com/flyer.png,https://www.megatravel.pe/es/,https://cafe.megatravel.pe/,draft'
test('importar el mismo CSV dos veces actualiza una salida y reutiliza categorías', async () => {
  const payload = persistence()
  const first = await importCSV(payload, csv, {}, { dryRun: false, downloadImages: false })
  const second = await importCSV(payload, csv.replace(',3599,', ',3799,'), {}, { dryRun: false, downloadImages: false })
  assert.equal(first.results[0].status, 'created'); assert.equal(second.results[0].status, 'updated')
  assert.equal(payload.tables.get('departures').length, 1); assert.equal(payload.tables.get('departures')[0].price, 3799)
  assert.equal(payload.tables.get('destinations').length, 1); assert.equal(payload.tables.get('origins').length, 1)
})
test('validación de CSV no escribe registros ni categorías', async () => {
  const payload = persistence()
  const report = await importCSV(payload, csv, {}, { dryRun: true, downloadImages: true })
  assert.equal(report.accepted, 1); assert.equal(report.results[0].status, 'would-create')
  assert.equal(payload.tables.get('departures').length, 0); assert.equal(payload.tables.has('destinations'), false)
})
test('el importador no reactiva una salida retirada ni borra su motivo', async () => {
  const payload = persistence()
  await importCSV(payload, csv.replace(',draft', ',withdrawn'), {}, { dryRun: false, downloadImages: false, historical: true })
  const original = payload.tables.get('departures')[0]; original.withdrawalReason = 'sold-out'; original.withdrawalNote = 'Revisión reciente'
  const report = await importCSV(payload, csv.replace(',draft', ',published'), {}, { dryRun: true, downloadImages: false })
  assert.equal(report.errors, 1)
  await importCSV(payload, csv.replace(',draft', ',withdrawn'), {}, { dryRun: false, downloadImages: false, historical: true })
  assert.equal(original.withdrawalReason, 'sold-out'); assert.equal(original.withdrawalNote, 'Revisión reciente')
})
