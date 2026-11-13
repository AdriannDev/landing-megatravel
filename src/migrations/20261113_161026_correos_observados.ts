import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_seat_mail_events_status" AS ENUM('pending', 'confirmed', 'cancelled', 'expired');
  CREATE TYPE "public"."enum_seat_mail_events_observation" AS ENUM('blocked', 'warning');
  ALTER TABLE "seat_mail_events" ADD COLUMN "source_key" varchar;
  ALTER TABLE "seat_mail_events" ADD COLUMN "subject" varchar;
  ALTER TABLE "seat_mail_events" ADD COLUMN "sender" varchar;
  ALTER TABLE "seat_mail_events" ADD COLUMN "received_at" timestamp(3) with time zone;
  ALTER TABLE "seat_mail_events" ADD COLUMN "seats" numeric;
  ALTER TABLE "seat_mail_events" ADD COLUMN "status" "enum_seat_mail_events_status";
  ALTER TABLE "seat_mail_events" ADD COLUMN "travel_date" varchar;
  ALTER TABLE "seat_mail_events" ADD COLUMN "occurred_at" timestamp(3) with time zone;
  ALTER TABLE "seat_mail_events" ADD COLUMN "version" numeric;
  ALTER TABLE "seat_mail_events" ADD COLUMN "observation" "enum_seat_mail_events_observation";
  CREATE UNIQUE INDEX "seat_mail_events_source_key_idx" ON "seat_mail_events" USING btree ("source_key");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "seat_mail_events" WHERE "source_key" IS NOT NULL OR "subject" IS NOT NULL
      OR "sender" IS NOT NULL OR "received_at" IS NOT NULL OR "seats" IS NOT NULL OR "status" IS NOT NULL
      OR "travel_date" IS NOT NULL OR "occurred_at" IS NOT NULL OR "version" IS NOT NULL OR "observation" IS NOT NULL) THEN
      RAISE EXCEPTION 'No se puede revertir: hay metadatos de correos observados. Respalda y concilia los registros antes de revertir.';
    END IF;
   END $$;
  DROP INDEX "seat_mail_events_source_key_idx";
  ALTER TABLE "seat_mail_events" DROP COLUMN "source_key";
  ALTER TABLE "seat_mail_events" DROP COLUMN "subject";
  ALTER TABLE "seat_mail_events" DROP COLUMN "sender";
  ALTER TABLE "seat_mail_events" DROP COLUMN "received_at";
  ALTER TABLE "seat_mail_events" DROP COLUMN "seats";
  ALTER TABLE "seat_mail_events" DROP COLUMN "status";
  ALTER TABLE "seat_mail_events" DROP COLUMN "travel_date";
  ALTER TABLE "seat_mail_events" DROP COLUMN "occurred_at";
  ALTER TABLE "seat_mail_events" DROP COLUMN "version";
  ALTER TABLE "seat_mail_events" DROP COLUMN "observation";
  DROP TYPE "public"."enum_seat_mail_events_status";
  DROP TYPE "public"."enum_seat_mail_events_observation";`)
}
