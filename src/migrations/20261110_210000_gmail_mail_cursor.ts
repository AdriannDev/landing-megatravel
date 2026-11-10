import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_mail_sync_cursors_provider" AS ENUM('gmail-imap', 'microsoft-graph');
    ALTER TABLE "mail_sync_cursors" ADD COLUMN "provider" "enum_mail_sync_cursors_provider" DEFAULT 'microsoft-graph';
    ALTER TABLE "mail_sync_cursors" ADD COLUMN "uid_validity" varchar;
    ALTER TABLE "mail_sync_cursors" ADD COLUMN "last_uid" numeric;
  `)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "mail_sync_cursors" WHERE "provider" = 'gmail-imap' OR "uid_validity" IS NOT NULL OR "last_uid" IS NOT NULL) THEN
        RAISE EXCEPTION 'No se puede revertir: existe progreso de Gmail. Conserva el cursor antes de revertir.';
      END IF;
    END $$;
    ALTER TABLE "mail_sync_cursors" DROP COLUMN "last_uid";
    ALTER TABLE "mail_sync_cursors" DROP COLUMN "uid_validity";
    ALTER TABLE "mail_sync_cursors" DROP COLUMN "provider";
    DROP TYPE "public"."enum_mail_sync_cursors_provider";
  `)
}
