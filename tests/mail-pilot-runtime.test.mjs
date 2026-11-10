import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('el proceso del lector libera PostgreSQL después de leer o fallar', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict'
    import { EventEmitter } from 'node:events'
    import { postgresAdapter } from '@payloadcms/db-postgres'
    import { buildConfig } from 'payload'
    import { withMailPilotPayload } from './scripts/mail-pilot-payload.ts'

    const connections = new Set()
    class TestClient extends EventEmitter {
      constructor() {
        super()
        this._queryable = true
      }
      connect(done) {
        connections.add(this)
        // Like an open socket, this timer keeps the child alive until pg closes it.
        this.handle = setInterval(() => {}, 1000)
        queueMicrotask(() => done(null))
      }
      end(done) {
        this._ending = true
        clearInterval(this.handle)
        connections.delete(this)
        if (done) queueMicrotask(done)
        return Promise.resolve()
      }
    }

    const config = () => buildConfig({
      secret: 'mail-pilot-runtime-test-secret-only',
      typescript: { autoGenerate: false },
      db: postgresAdapter({ push: false, pool: { Client: TestClient, idleTimeoutMillis: 0 } }),
    })
    const read = async payload => {
      const client = await payload.db.pool.connect()
      client.release()
      return { status: 'read', processed: 0 }
    }

    assert.deepEqual(await withMailPilotPayload(config(), read), { status: 'read', processed: 0 })
    assert.equal(connections.size, 0)
    await assert.rejects(withMailPilotPayload(config(), async payload => {
      await read(payload)
      throw new Error('Fallo simulado de lectura')
    }), /Fallo simulado de lectura/)
    assert.equal(connections.size, 0)
  `], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'test', PAYLOAD_TELEMETRY_DISABLED: 'true' },
    encoding: 'utf8',
    timeout: 20_000,
  })
  assert.ifError(child.error)
  assert.equal(child.status, 0, child.stderr || child.stdout)
})
