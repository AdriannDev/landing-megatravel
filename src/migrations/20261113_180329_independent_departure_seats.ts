import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "seat_pilot_pools_mtpe_idx";
  ALTER TABLE "departures" ALTER COLUMN "program_last_seats" DROP DEFAULT;
  ALTER TABLE "departures" ALTER COLUMN "last_seats" DROP DEFAULT;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_program_last_seats" DROP DEFAULT;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_last_seats" DROP DEFAULT;
  ALTER TABLE "departures" ADD COLUMN "seats_reconciled_at" timestamp(3) with time zone;
  ALTER TABLE "departures" ADD COLUMN "seats_reconciled_quantity" numeric;
  ALTER TABLE "_departures_v" ADD COLUMN "version_seats_reconciled_at" timestamp(3) with time zone;
  ALTER TABLE "_departures_v" ADD COLUMN "version_seats_reconciled_quantity" numeric;
  ALTER TABLE "seat_pilot_pools" ADD COLUMN "departure_stable_id" varchar;
  ALTER TABLE "seat_pilot_pools" ADD COLUMN "travel_date" varchar;
  ALTER TABLE "seat_pilot_pools" ADD COLUMN "origin" varchar;
  ALTER TABLE "seat_mail_events" ADD COLUMN "origin" varchar;
  ALTER TABLE "seat_mail_events" ADD COLUMN "resolved_departure" varchar;
  ALTER TABLE "seat_mail_events" ADD COLUMN "movements" jsonb;
  CREATE UNIQUE INDEX "seat_pilot_pools_departure_stable_id_idx" ON "seat_pilot_pools" USING btree ("departure_stable_id");
  CREATE INDEX "seat_pilot_pools_mtpe_idx" ON "seat_pilot_pools" USING btree ("mtpe");
  -- Preserve sort, filters and every existing column preference. Insert/activate seats after origin/date.
  DO $$ DECLARE pref RECORD; cols jsonb; entry jsonb; inserted boolean; anchor text; BEGIN
    FOR pref IN SELECT id,value FROM payload_preferences WHERE key='collection-departures' AND jsonb_typeof(value->'columns')='array' LOOP
      cols := '[]'::jsonb; inserted := false;
      anchor := CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(pref.value->'columns') c WHERE c->>'accessor'='origin') THEN 'origin' ELSE 'travelDate' END;
      FOR entry IN SELECT c FROM jsonb_array_elements(pref.value->'columns') c LOOP
        IF entry->>'accessor'='availableSeats' THEN CONTINUE; END IF;
        cols := cols || jsonb_build_array(entry);
        IF entry->>'accessor'=anchor THEN cols := cols || '[{"accessor":"availableSeats","active":true}]'::jsonb; inserted := true; END IF;
      END LOOP;
      IF NOT inserted THEN cols := cols || '[{"accessor":"availableSeats","active":true}]'::jsonb; END IF;
      UPDATE payload_preferences SET value=jsonb_set(jsonb_set(pref.value,'{columns}',cols),'{seatColumnsVersion}','1'::jsonb) WHERE id=pref.id;
    END LOOP;
  END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM departures WHERE seats_reconciled_at IS NOT NULL OR seats_reconciled_quantity IS NOT NULL)
       OR EXISTS (SELECT 1 FROM _departures_v WHERE version_seats_reconciled_at IS NOT NULL OR version_seats_reconciled_quantity IS NOT NULL)
       OR EXISTS (SELECT 1 FROM seat_pilot_pools WHERE departure_stable_id IS NOT NULL OR travel_date IS NOT NULL OR origin IS NOT NULL)
       OR EXISTS (SELECT 1 FROM seat_mail_events WHERE origin IS NOT NULL OR resolved_departure IS NOT NULL OR movements IS NOT NULL) THEN
       RAISE EXCEPTION 'No se puede revertir: hay conciliaciones o movimientos por salida. Respalda y concilia antes de revertir.';
     END IF;
   END $$;
   DROP INDEX "seat_pilot_pools_departure_stable_id_idx";
  DROP INDEX "seat_pilot_pools_mtpe_idx";
  ALTER TABLE "departures" ALTER COLUMN "program_last_seats" SET DEFAULT false;
  ALTER TABLE "departures" ALTER COLUMN "last_seats" SET DEFAULT false;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_program_last_seats" SET DEFAULT false;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_last_seats" SET DEFAULT false;
  CREATE UNIQUE INDEX "seat_pilot_pools_mtpe_idx" ON "seat_pilot_pools" USING btree ("mtpe");
  ALTER TABLE "departures" DROP COLUMN "seats_reconciled_at";
  ALTER TABLE "departures" DROP COLUMN "seats_reconciled_quantity";
  ALTER TABLE "_departures_v" DROP COLUMN "version_seats_reconciled_at";
  ALTER TABLE "_departures_v" DROP COLUMN "version_seats_reconciled_quantity";
  ALTER TABLE "seat_pilot_pools" DROP COLUMN "departure_stable_id";
  ALTER TABLE "seat_pilot_pools" DROP COLUMN "travel_date";
  ALTER TABLE "seat_pilot_pools" DROP COLUMN "origin";
  ALTER TABLE "seat_mail_events" DROP COLUMN "origin";
  ALTER TABLE "seat_mail_events" DROP COLUMN "resolved_departure";
  ALTER TABLE "seat_mail_events" DROP COLUMN "movements";`)
}
