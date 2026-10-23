import 'server-only'
export async function getCMS() {
  if (!process.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET.length < 32 || process.env.PAYLOAD_SECRET.startsWith('replace-')) throw new Error('Configura PAYLOAD_SECRET con al menos 32 caracteres aleatorios.')
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL de PostgreSQL.')
  if (!process.env.DATABASE_URL && process.env.USE_SQLITE !== 'true') throw new Error('Configura PostgreSQL o USE_SQLITE=true para desarrollo local.')
  const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('@payload-config')])
  return getPayload({ config })
}
