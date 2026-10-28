import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { s3Storage } from '@payloadcms/storage-s3'
import { es } from '@payloadcms/translations/languages/es'
import sharp from 'sharp'
import { Users } from './collections/users'
import { AuditLog, Banners, Campaigns, CruiseLines, Departures, Destinations, Media, Origins, Programs, Settings } from './collections/content'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const useSqlite = process.env.USE_SQLITE === 'true' && process.env.NODE_ENV !== 'production'
if (process.env.NODE_ENV === 'production' && (!process.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET.length < 32 || process.env.PAYLOAD_SECRET.startsWith('replace-'))) {
  throw new Error('Configura un PAYLOAD_SECRET aleatorio de al menos 32 caracteres antes de iniciar en producción.')
}
export default buildConfig({
  secret: process.env.PAYLOAD_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'development-only-replace-this-secret-before-deploy'),
  serverURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  cors: [process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'],
  csrf: [process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'],
  admin: {
    user: 'users', importMap: { baseDir: dirname },
    meta: { titleSuffix: ' | Equipo Megatravel' },
    components: { views: { dashboard: { Component: '/components/admin/admin-home#AdminHome' }, newDeparture: { Component: '/components/admin/new-departure-view#NewDepartureView', path: '/new-departure', exact: true } } },
    dateFormat: 'dd/MM/yyyy HH:mm',
    timezones: { defaultTimezone: 'America/Lima', supportedTimezones: [{ label: 'Lima (UTC−05:00)', value: 'America/Lima' }] },
  },
  i18n: { fallbackLanguage: 'es', supportedLanguages: { es } },
  collections: [Users, Departures, Programs, Media, Campaigns, Banners, Destinations, Origins, CruiseLines, AuditLog],
  globals: [Settings],
  graphQL: { disable: true },
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: useSqlite ? sqliteAdapter({ client: { url: process.env.SQLITE_URL || 'file:./megatravel.db' }, push: true, transactionOptions: { behavior: 'immediate' } }) : postgresAdapter({ pool: { connectionString: process.env.DATABASE_URL || '' }, push: process.env.NODE_ENV !== 'production', migrationDir: path.resolve(dirname, 'migrations') }),
  sharp,
  upload: { limits: { fileSize: 12 * 1024 * 1024 } },
  plugins: process.env.R2_BUCKET ? [s3Storage({
    collections: { media: { generateFileURL: ({ filename, prefix }) => `${process.env.R2_PUBLIC_URL}/${prefix ? prefix + '/' : ''}${filename}` } },
    bucket: process.env.R2_BUCKET,
    config: { region: 'auto', endpoint: process.env.R2_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID || '', secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '' } },
  })] : [],
})
