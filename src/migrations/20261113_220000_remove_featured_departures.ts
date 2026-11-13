import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

// Run only after a verified full database backup (see docs/operacion.md).
// Historical migrations also add blog images and must remain intact.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "settings" DROP CONSTRAINT "settings_featured_departure1_id_departures_id_fk";
    ALTER TABLE "settings" DROP CONSTRAINT "settings_featured_departure2_id_departures_id_fk";
    DROP INDEX "settings_featured_departure1_idx";
    DROP INDEX "settings_featured_departure2_idx";
    ALTER TABLE "settings" DROP COLUMN "featured_departure1_id";
    ALTER TABLE "settings" DROP COLUMN "featured_departure2_id";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Configuration values require the pre-migration backup to restore.
  await db.execute(sql`
    ALTER TABLE "settings" ADD COLUMN "featured_departure1_id" integer;
    ALTER TABLE "settings" ADD COLUMN "featured_departure2_id" integer;
    ALTER TABLE "settings" ADD CONSTRAINT "settings_featured_departure1_id_departures_id_fk" FOREIGN KEY ("featured_departure1_id") REFERENCES "public"."departures"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "settings" ADD CONSTRAINT "settings_featured_departure2_id_departures_id_fk" FOREIGN KEY ("featured_departure2_id") REFERENCES "public"."departures"("id") ON DELETE set null ON UPDATE no action;
    CREATE INDEX "settings_featured_departure1_idx" ON "settings" USING btree ("featured_departure1_id");
    CREATE INDEX "settings_featured_departure2_idx" ON "settings" USING btree ("featured_departure2_id");
  `)
}
