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
  const commit = process.argv.includes('--commit')
  let validationTokens: Record<string, string> = {}
  if (commit) {
    try {
      const validation = JSON.parse(await readFile('migration/import-report-dry-run.json', 'utf8'))
      validationTokens = Object.fromEntries((validation.results || []).filter((r: { validationToken?: string }) => r.validationToken).map((r: { row: number; validationToken: string }) => [String(r.row), r.validationToken]))
    } catch { /* Old CSVs without seat columns need no seat confirmation. */ }
  }
  const report = await importCSV(payload, await readFile(file, 'utf8'), req, { dryRun: !commit, downloadImages: !process.argv.includes('--skip-images'), historical: process.argv.includes('--historical'), seatsConfirmed: process.argv.includes('--confirm-seats'), validationTokens })
  await writeFile('migration/import-report-' + (report.dryRun ? 'dry-run' : 'commit') + '.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ dryRun: report.dryRun, total: report.total, accepted: report.accepted, errors: report.errors }))
  if (report.errors) process.exitCode = 1
} finally { await payload.destroy() }
