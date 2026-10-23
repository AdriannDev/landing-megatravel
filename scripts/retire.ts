import { getPayload } from 'payload'
import config from '../src/payload.config'
import { retireExpired } from '../src/server/retire-service'
const payload = await getPayload({ config })
try { const report = await retireExpired(payload); console.log(JSON.stringify(report)); if (report.errors) process.exitCode = 1 }
finally { await payload.destroy() }
