import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TYPE "public"."enum_audit_log_event" ADD VALUE IF NOT EXISTS 'deleted';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // PostgreSQL cannot remove an enum value safely while audit entries refer to it.
  // Keep it available when rolling back to preserve the history.
  await db.execute(sql`SELECT 1;`)
}
