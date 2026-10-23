import { getPayload } from 'payload'
import config from '../src/payload.config'
if (!process.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET.length < 32) throw new Error('Configura PAYLOAD_SECRET antes de crear el administrador.')
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 14) throw new Error('Configura ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 14 caracteres) en el entorno local privado.')
const payload = await getPayload({ config })
try {
  const existing = await payload.count({ collection: 'users', overrideAccess: true })
  if (existing.totalDocs) throw new Error('Ya existen usuarios. Usa el panel de administración para gestionar cuentas.')
  await payload.create({ collection: 'users', overrideAccess: true, context: { bootstrap: true }, data: { name: 'Administrador Megatravel', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, role: 'admin' } })
  console.log('Administrador creado. Retira ADMIN_PASSWORD del entorno y entra en /admin.')
} finally { await payload.destroy() }
