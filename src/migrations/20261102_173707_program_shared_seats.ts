import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "departures" ALTER COLUMN "price_condition" SET DEFAULT 'Por persona en habitación doble';
  ALTER TABLE "_departures_v" ALTER COLUMN "version_price_condition" SET DEFAULT 'Por persona en habitación doble';
  ALTER TABLE "banners" ALTER COLUMN "button_label" SET DEFAULT 'Conocer más';
  ALTER TABLE "departures" ADD COLUMN "program_last_seats" boolean DEFAULT false;
  ALTER TABLE "departures" ADD COLUMN "last_seats_checked_at" timestamp(3) with time zone;
  ALTER TABLE "_departures_v" ADD COLUMN "version_program_last_seats" boolean DEFAULT false;
  ALTER TABLE "_departures_v" ADD COLUMN "version_last_seats_checked_at" timestamp(3) with time zone;
  ALTER TABLE "programs" ADD COLUMN "available_seats" numeric;
  ALTER TABLE "programs" ADD COLUMN "last_seats" boolean DEFAULT false;
  ALTER TABLE "programs" ADD COLUMN "seats_checked_at" timestamp(3) with time zone;
  ALTER TABLE "programs" ADD COLUMN "seats_confirmed" boolean DEFAULT false;
  ALTER TABLE "programs" ADD COLUMN "seats_migration_pending" boolean DEFAULT false;
  ALTER TABLE "programs" ADD COLUMN "legacy_seat_references" jsonb;
  ALTER TABLE "_programs_v" ADD COLUMN "version_available_seats" numeric;
  ALTER TABLE "_programs_v" ADD COLUMN "version_last_seats" boolean DEFAULT false;
  ALTER TABLE "_programs_v" ADD COLUMN "version_seats_checked_at" timestamp(3) with time zone;
  ALTER TABLE "_programs_v" ADD COLUMN "version_seats_confirmed" boolean DEFAULT false;
  ALTER TABLE "_programs_v" ADD COLUMN "version_seats_migration_pending" boolean DEFAULT false;
  ALTER TABLE "_programs_v" ADD COLUMN "version_legacy_seat_references" jsonb;
  CREATE INDEX "programs_seats_checked_at_idx" ON "programs" USING btree ("seats_checked_at");
  CREATE INDEX "_programs_v_version_version_seats_checked_at_idx" ON "_programs_v" USING btree ("version_seats_checked_at");
  UPDATE "departures" SET "last_seats_checked_at" = "seats_checked_at" WHERE "last_seats" = true;
  UPDATE "_departures_v" SET "version_last_seats_checked_at" = "version_seats_checked_at" WHERE "version_last_seats" = true;
  WITH legacy AS (
    SELECT "program_ref_id" AS program_id,
      count(DISTINCT "available_seats") AS amounts,
      bool_or("available_seats" < 0 OR "available_seats" <> trunc("available_seats") OR "available_seats" > 9007199254740991) AS invalid,
      min("available_seats") AS seats,
      CASE WHEN bool_and("seats_checked_at" IS NOT NULL) FILTER (WHERE "available_seats" IS NOT NULL)
        THEN min("seats_checked_at") FILTER (WHERE "available_seats" IS NOT NULL) ELSE NULL END AS checked,
      jsonb_agg(jsonb_build_object('departureId', "id", 'availableSeats', "available_seats", 'lastSeats', "last_seats", 'seatsCheckedAt', "seats_checked_at", 'originId', "origin_id", 'travelDate', "travel_date") ORDER BY "id") AS backup
    FROM "departures" WHERE "program_ref_id" IS NOT NULL GROUP BY "program_ref_id"
  ) UPDATE "programs" p SET
    "available_seats" = CASE WHEN legacy.amounts = 1 AND NOT coalesce(legacy.invalid, false) THEN legacy.seats ELSE NULL END,
    "seats_checked_at" = CASE WHEN legacy.amounts = 1 AND NOT coalesce(legacy.invalid, false) THEN legacy.checked ELSE NULL END,
    "seats_migration_pending" = legacy.amounts > 1 OR coalesce(legacy.invalid, false),
    "legacy_seat_references" = legacy.backup
  FROM legacy WHERE p."id" = legacy.program_id;
  UPDATE "departures" d SET "available_seats" = p."available_seats", "seats_checked_at" = p."seats_checked_at", "program_last_seats" = p."last_seats"
    FROM "programs" p WHERE d."program_ref_id" = p."id";
  ALTER TABLE "departures" DROP COLUMN "flyer_download_warning";
  ALTER TABLE "_departures_v" DROP COLUMN "version_flyer_download_warning";
  ALTER TABLE "programs" DROP COLUMN "flyer_download_warning";
  ALTER TABLE "_programs_v" DROP COLUMN "version_flyer_download_warning";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM "programs" WHERE "available_seats" IS NOT NULL OR "last_seats" = true OR "legacy_seat_references" IS NOT NULL)
       OR EXISTS (SELECT 1 FROM "_programs_v" WHERE "version_available_seats" IS NOT NULL OR "version_last_seats" = true OR "version_legacy_seat_references" IS NOT NULL) THEN
       RAISE EXCEPTION 'No se puede revertir: existen cupos compartidos o respaldos históricos. Respalda y concilia los datos antes de revertir.';
     END IF;
   END $$;
   DROP INDEX "programs_seats_checked_at_idx";
  DROP INDEX "_programs_v_version_version_seats_checked_at_idx";
  ALTER TABLE "departures" ADD COLUMN "flyer_download_warning" varchar;
  ALTER TABLE "_departures_v" ADD COLUMN "version_flyer_download_warning" varchar;
  ALTER TABLE "programs" ADD COLUMN "flyer_download_warning" varchar;
  ALTER TABLE "_programs_v" ADD COLUMN "version_flyer_download_warning" varchar;
  ALTER TABLE "departures" DROP COLUMN "program_last_seats";
  ALTER TABLE "departures" DROP COLUMN "last_seats_checked_at";
  ALTER TABLE "_departures_v" DROP COLUMN "version_program_last_seats";
  ALTER TABLE "_departures_v" DROP COLUMN "version_last_seats_checked_at";
  ALTER TABLE "programs" DROP COLUMN "available_seats";
  ALTER TABLE "programs" DROP COLUMN "last_seats";
  ALTER TABLE "programs" DROP COLUMN "seats_checked_at";
  ALTER TABLE "programs" DROP COLUMN "seats_confirmed";
  ALTER TABLE "programs" DROP COLUMN "seats_migration_pending";
  ALTER TABLE "programs" DROP COLUMN "legacy_seat_references";
  ALTER TABLE "_programs_v" DROP COLUMN "version_available_seats";
  ALTER TABLE "_programs_v" DROP COLUMN "version_last_seats";
  ALTER TABLE "_programs_v" DROP COLUMN "version_seats_checked_at";
  ALTER TABLE "_programs_v" DROP COLUMN "version_seats_confirmed";
  ALTER TABLE "_programs_v" DROP COLUMN "version_seats_migration_pending";
  ALTER TABLE "_programs_v" DROP COLUMN "version_legacy_seat_references";`)
}
