import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "departures" ADD COLUMN "available_seats" numeric;
  ALTER TABLE "departures" ADD COLUMN "last_seats" boolean DEFAULT false;
  ALTER TABLE "departures" ADD COLUMN "seats_checked_at" timestamp(3) with time zone;
  ALTER TABLE "departures" ADD COLUMN "seats_confirmed" boolean DEFAULT false;
  ALTER TABLE "_departures_v" ADD COLUMN "version_available_seats" numeric;
  ALTER TABLE "_departures_v" ADD COLUMN "version_last_seats" boolean DEFAULT false;
  ALTER TABLE "_departures_v" ADD COLUMN "version_seats_checked_at" timestamp(3) with time zone;
  ALTER TABLE "_departures_v" ADD COLUMN "version_seats_confirmed" boolean DEFAULT false;
  ALTER TABLE "settings" ADD COLUMN "seats_validity_hours" numeric DEFAULT 72 NOT NULL;
  CREATE INDEX "departures_seats_checked_at_idx" ON "departures" USING btree ("seats_checked_at");
  CREATE INDEX "_departures_v_version_version_seats_checked_at_idx" ON "_departures_v" USING btree ("version_seats_checked_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM "departures" WHERE "available_seats" IS NOT NULL OR "last_seats" = true OR "seats_checked_at" IS NOT NULL)
       OR EXISTS (SELECT 1 FROM "_departures_v" WHERE "version_available_seats" IS NOT NULL OR "version_last_seats" = true OR "version_seats_checked_at" IS NOT NULL)
       OR EXISTS (SELECT 1 FROM "settings" WHERE "seats_validity_hours" <> 72) THEN
       RAISE EXCEPTION 'No se puede revertir: existen referencias de cupos, versiones o una vigencia personalizada. Respalda y concilia estos datos antes de revertir.';
     END IF;
   END $$;
  DROP INDEX "departures_seats_checked_at_idx";
  DROP INDEX "_departures_v_version_version_seats_checked_at_idx";
  ALTER TABLE "departures" DROP COLUMN "available_seats";
  ALTER TABLE "departures" DROP COLUMN "last_seats";
  ALTER TABLE "departures" DROP COLUMN "seats_checked_at";
  ALTER TABLE "departures" DROP COLUMN "seats_confirmed";
  ALTER TABLE "_departures_v" DROP COLUMN "version_available_seats";
  ALTER TABLE "_departures_v" DROP COLUMN "version_last_seats";
  ALTER TABLE "_departures_v" DROP COLUMN "version_seats_checked_at";
  ALTER TABLE "_departures_v" DROP COLUMN "version_seats_confirmed";
  ALTER TABLE "settings" DROP COLUMN "seats_validity_hours";`)
}
