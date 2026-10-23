import { readFile, writeFile } from 'node:fs/promises'
import { createLocalReq, getPayload } from 'payload'
import config from '../src/payload.config'
import { importCSV } from '../src/server/import-service'
const payload = await getPayload({ config })
try {
  if (!process.env.ADMIN_EMAIL) throw new Error('Configura ADMIN_EMAIL para atribuir la importación.')
  const users = await payload.find({ collection: 'users', overrideAccess: true, where: { email: { equals: process.env.ADMIN_EMAIL } }, limit: 1 })
  const user = users.docs[0]
  if (!user || user.role !== 'admin') throw new Error('No existe el administrador indicado.')
  const req = await createLocalReq({ user: { ...user, collection: 'users' } }, payload)
  const file = process.argv.find(arg => arg.endsWith('.csv')) || 'migration/departures.csv'
  const report = await importCSV(payload, await readFile(file, 'utf8'), req, { dryRun: !process.argv.includes('--commit'), downloadImages: !process.argv.includes('--skip-images'), historical: process.argv.includes('--historical') })
  await writeFile('migration/import-report-' + (report.dryRun ? 'dry-run' : 'commit') + '.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ dryRun: report.dryRun, total: report.total, accepted: report.accepted, errors: report.errors }))
  if (report.errors) process.exitCode = 1
} finally { await payload.destroy() }
