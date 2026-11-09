import { getPayload } from 'payload'
import config from '../src/payload.config'
import { syncMegaTravelBlog } from '../src/server/blog-service'

const payload = await getPayload({ config })
try {
  const result = await syncMegaTravelBlog(payload, { force: true })
  console.log(JSON.stringify(result))
  if (result.status === 'failed') process.exitCode = 1
} finally {
  await payload.destroy()
}

process.exit(process.exitCode || 0)
