import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_audit_log_entity_type" AS ENUM('departure', 'program');
  CREATE TYPE "public"."enum_seat_mail_events_outcome" AS ENUM('proposed', 'review', 'duplicate');
  CREATE TABLE "seat_pilot_pools" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"mtpe" varchar NOT NULL,
  	"program_id" varchar NOT NULL,
  	"program_created_at" timestamp(3) with time zone NOT NULL,
  	"program_name" varchar NOT NULL,
  	"initial_seats" numeric NOT NULL,
  	"remaining_seats" numeric NOT NULL,
  	"cutoff_at" timestamp(3) with time zone NOT NULL,
  	"actor_label" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "seat_pilot_reservations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"mtpe" varchar NOT NULL,
  	"reservation" varchar NOT NULL,
  	"state" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "seat_mail_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"message_key" varchar NOT NULL,
  	"event_key" varchar,
  	"duplicate_of" varchar,
  	"mtpe" varchar,
  	"reservation" varchar,
  	"outcome" "enum_seat_mail_events_outcome" NOT NULL,
  	"reason" varchar NOT NULL,
  	"event" jsonb,
  	"delta" numeric,
  	"balance_before" numeric,
  	"balance_after" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mail_sync_cursors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"cursor" varchar,
  	"owner" varchar,
  	"lease_until" timestamp(3) with time zone,
  	"last_success_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "audit_log" ALTER COLUMN "departure_id" DROP NOT NULL;
  ALTER TABLE "audit_log" ADD COLUMN "entity_type" "enum_audit_log_entity_type" DEFAULT 'departure';
  ALTER TABLE "audit_log" ADD COLUMN "program_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "seat_pilot_pools_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "seat_pilot_reservations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "seat_mail_events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mail_sync_cursors_id" integer;
  CREATE UNIQUE INDEX "seat_pilot_pools_mtpe_idx" ON "seat_pilot_pools" USING btree ("mtpe");
  CREATE INDEX "seat_pilot_pools_updated_at_idx" ON "seat_pilot_pools" USING btree ("updated_at");
  CREATE INDEX "seat_pilot_pools_created_at_idx" ON "seat_pilot_pools" USING btree ("created_at");
  CREATE UNIQUE INDEX "seat_pilot_reservations_key_idx" ON "seat_pilot_reservations" USING btree ("key");
  CREATE INDEX "seat_pilot_reservations_mtpe_idx" ON "seat_pilot_reservations" USING btree ("mtpe");
  CREATE INDEX "seat_pilot_reservations_updated_at_idx" ON "seat_pilot_reservations" USING btree ("updated_at");
  CREATE INDEX "seat_pilot_reservations_created_at_idx" ON "seat_pilot_reservations" USING btree ("created_at");
  CREATE UNIQUE INDEX "seat_mail_events_message_key_idx" ON "seat_mail_events" USING btree ("message_key");
  CREATE UNIQUE INDEX "seat_mail_events_event_key_idx" ON "seat_mail_events" USING btree ("event_key");
  CREATE INDEX "seat_mail_events_mtpe_idx" ON "seat_mail_events" USING btree ("mtpe");
  CREATE INDEX "seat_mail_events_outcome_idx" ON "seat_mail_events" USING btree ("outcome");
  CREATE INDEX "seat_mail_events_updated_at_idx" ON "seat_mail_events" USING btree ("updated_at");
  CREATE INDEX "seat_mail_events_created_at_idx" ON "seat_mail_events" USING btree ("created_at");
  CREATE UNIQUE INDEX "mail_sync_cursors_key_idx" ON "mail_sync_cursors" USING btree ("key");
  CREATE INDEX "mail_sync_cursors_updated_at_idx" ON "mail_sync_cursors" USING btree ("updated_at");
  CREATE INDEX "mail_sync_cursors_created_at_idx" ON "mail_sync_cursors" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seat_pilot_pools_fk" FOREIGN KEY ("seat_pilot_pools_id") REFERENCES "public"."seat_pilot_pools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seat_pilot_reservations_fk" FOREIGN KEY ("seat_pilot_reservations_id") REFERENCES "public"."seat_pilot_reservations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_seat_mail_events_fk" FOREIGN KEY ("seat_mail_events_id") REFERENCES "public"."seat_mail_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mail_sync_cursors_fk" FOREIGN KEY ("mail_sync_cursors_id") REFERENCES "public"."mail_sync_cursors"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "audit_log_program_id_idx" ON "audit_log" USING btree ("program_id");
  CREATE INDEX "payload_locked_documents_rels_seat_pilot_pools_id_idx" ON "payload_locked_documents_rels" USING btree ("seat_pilot_pools_id");
  CREATE INDEX "payload_locked_documents_rels_seat_pilot_reservations_id_idx" ON "payload_locked_documents_rels" USING btree ("seat_pilot_reservations_id");
  CREATE INDEX "payload_locked_documents_rels_seat_mail_events_id_idx" ON "payload_locked_documents_rels" USING btree ("seat_mail_events_id");
  CREATE INDEX "payload_locked_documents_rels_mail_sync_cursors_id_idx" ON "payload_locked_documents_rels" USING btree ("mail_sync_cursors_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM "seat_pilot_pools") OR EXISTS (SELECT 1 FROM "seat_pilot_reservations")
      OR EXISTS (SELECT 1 FROM "seat_mail_events") OR EXISTS (SELECT 1 FROM "mail_sync_cursors")
      OR EXISTS (SELECT 1 FROM "audit_log" WHERE "entity_type" = 'program' OR "departure_id" IS NULL OR "program_id" IS NOT NULL) THEN
      RAISE EXCEPTION 'No se puede revertir: hay datos del piloto o auditoría ampliada. Respalda y concilia el historial antes de revertir.';
    END IF;
   END $$;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_seat_pilot_pools_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_seat_pilot_reservations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_seat_mail_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mail_sync_cursors_fk";
  
  DROP INDEX "audit_log_program_id_idx";
  DROP INDEX "payload_locked_documents_rels_seat_pilot_pools_id_idx";
  DROP INDEX "payload_locked_documents_rels_seat_pilot_reservations_id_idx";
  DROP INDEX "payload_locked_documents_rels_seat_mail_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_mail_sync_cursors_id_idx";
  ALTER TABLE "audit_log" ALTER COLUMN "departure_id" SET NOT NULL;
  ALTER TABLE "audit_log" DROP COLUMN "entity_type";
  ALTER TABLE "audit_log" DROP COLUMN "program_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "seat_pilot_pools_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "seat_pilot_reservations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "seat_mail_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mail_sync_cursors_id";
  DROP TABLE "seat_pilot_pools";
  DROP TABLE "seat_pilot_reservations";
  DROP TABLE "seat_mail_events";
  DROP TABLE "mail_sync_cursors";
  DROP TYPE "public"."enum_audit_log_entity_type";
  DROP TYPE "public"."enum_seat_mail_events_outcome";`)
}
