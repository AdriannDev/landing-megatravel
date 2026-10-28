import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_banners_placement" AS ENUM('hero', 'between-results', 'catalog-end');
  CREATE TABLE "programs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"program" varchar NOT NULL,
  	"mtpe" varchar NOT NULL,
  	"destination_id" integer NOT NULL,
  	"zone" varchar NOT NULL,
  	"days" numeric NOT NULL,
  	"nights" numeric,
  	"cruise_line_id" integer,
  	"flyer_id" integer,
  	"flyer_source_url" varchar,
  	"flyer_download_warning" varchar,
  	"booking_url" varchar,
  	"description_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_programs_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_program" varchar NOT NULL,
  	"version_mtpe" varchar NOT NULL,
  	"version_destination_id" integer NOT NULL,
  	"version_zone" varchar NOT NULL,
  	"version_days" numeric NOT NULL,
  	"version_nights" numeric,
  	"version_cruise_line_id" integer,
  	"version_flyer_id" integer,
  	"version_flyer_source_url" varchar,
  	"version_flyer_download_warning" varchar,
  	"version_booking_url" varchar,
  	"version_description_url" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "departures" ALTER COLUMN "program" DROP NOT NULL;
  ALTER TABLE "departures" ALTER COLUMN "mtpe" DROP NOT NULL;
  ALTER TABLE "departures" ALTER COLUMN "destination_id" DROP NOT NULL;
  ALTER TABLE "departures" ALTER COLUMN "zone" DROP NOT NULL;
  ALTER TABLE "departures" ALTER COLUMN "days" DROP NOT NULL;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_program" DROP NOT NULL;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_mtpe" DROP NOT NULL;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_destination_id" DROP NOT NULL;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_zone" DROP NOT NULL;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_days" DROP NOT NULL;
  ALTER TABLE "departures" ADD COLUMN "program_ref_id" integer;
  ALTER TABLE "departures" ADD COLUMN "departure_key" varchar;
  ALTER TABLE "_departures_v" ADD COLUMN "version_program_ref_id" integer;
  ALTER TABLE "_departures_v" ADD COLUMN "version_departure_key" varchar;
  ALTER TABLE "banners" ADD COLUMN "placement" "enum_banners_placement" DEFAULT 'hero' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "programs_id" integer;
  ALTER TABLE "programs" ADD CONSTRAINT "programs_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs" ADD CONSTRAINT "programs_cruise_line_id_cruise_lines_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "public"."cruise_lines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programs" ADD CONSTRAINT "programs_flyer_id_media_id_fk" FOREIGN KEY ("flyer_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programs_v" ADD CONSTRAINT "_programs_v_parent_id_programs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programs_v" ADD CONSTRAINT "_programs_v_version_destination_id_destinations_id_fk" FOREIGN KEY ("version_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programs_v" ADD CONSTRAINT "_programs_v_version_cruise_line_id_cruise_lines_id_fk" FOREIGN KEY ("version_cruise_line_id") REFERENCES "public"."cruise_lines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programs_v" ADD CONSTRAINT "_programs_v_version_flyer_id_media_id_fk" FOREIGN KEY ("version_flyer_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "programs_program_idx" ON "programs" USING btree ("program");
  CREATE UNIQUE INDEX "programs_mtpe_idx" ON "programs" USING btree ("mtpe");
  CREATE INDEX "programs_destination_idx" ON "programs" USING btree ("destination_id");
  CREATE INDEX "programs_cruise_line_idx" ON "programs" USING btree ("cruise_line_id");
  CREATE INDEX "programs_flyer_idx" ON "programs" USING btree ("flyer_id");
  CREATE INDEX "programs_updated_at_idx" ON "programs" USING btree ("updated_at");
  CREATE INDEX "programs_created_at_idx" ON "programs" USING btree ("created_at");
  CREATE INDEX "_programs_v_parent_idx" ON "_programs_v" USING btree ("parent_id");
  CREATE INDEX "_programs_v_version_version_program_idx" ON "_programs_v" USING btree ("version_program");
  CREATE INDEX "_programs_v_version_version_mtpe_idx" ON "_programs_v" USING btree ("version_mtpe");
  CREATE INDEX "_programs_v_version_version_destination_idx" ON "_programs_v" USING btree ("version_destination_id");
  CREATE INDEX "_programs_v_version_version_cruise_line_idx" ON "_programs_v" USING btree ("version_cruise_line_id");
  CREATE INDEX "_programs_v_version_version_flyer_idx" ON "_programs_v" USING btree ("version_flyer_id");
  CREATE INDEX "_programs_v_version_version_updated_at_idx" ON "_programs_v" USING btree ("version_updated_at");
  CREATE INDEX "_programs_v_version_version_created_at_idx" ON "_programs_v" USING btree ("version_created_at");
  CREATE INDEX "_programs_v_created_at_idx" ON "_programs_v" USING btree ("created_at");
  CREATE INDEX "_programs_v_updated_at_idx" ON "_programs_v" USING btree ("updated_at");
  ALTER TABLE "departures" ADD CONSTRAINT "departures_program_ref_id_programs_id_fk" FOREIGN KEY ("program_ref_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_departures_v" ADD CONSTRAINT "_departures_v_version_program_ref_id_programs_id_fk" FOREIGN KEY ("version_program_ref_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_programs_fk" FOREIGN KEY ("programs_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "departures_program_ref_idx" ON "departures" USING btree ("program_ref_id");
  CREATE UNIQUE INDEX "departures_departure_key_idx" ON "departures" USING btree ("departure_key");
  CREATE INDEX "_departures_v_version_version_program_ref_idx" ON "_departures_v" USING btree ("version_program_ref_id");
  CREATE INDEX "_departures_v_version_version_departure_key_idx" ON "_departures_v" USING btree ("version_departure_key");
  CREATE INDEX "payload_locked_documents_rels_programs_id_idx" ON "payload_locked_documents_rels" USING btree ("programs_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "departures" DROP CONSTRAINT IF EXISTS "departures_program_ref_id_programs_id_fk";
  
  ALTER TABLE "_departures_v" DROP CONSTRAINT IF EXISTS "_departures_v_version_program_ref_id_programs_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_programs_fk";
  ALTER TABLE "programs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_programs_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "_programs_v" CASCADE;
  DROP TABLE "programs" CASCADE;
  
  DROP INDEX "departures_program_ref_idx";
  DROP INDEX "departures_departure_key_idx";
  DROP INDEX "_departures_v_version_version_program_ref_idx";
  DROP INDEX "_departures_v_version_version_departure_key_idx";
  DROP INDEX "payload_locked_documents_rels_programs_id_idx";
  ALTER TABLE "departures" ALTER COLUMN "program" SET NOT NULL;
  ALTER TABLE "departures" ALTER COLUMN "mtpe" SET NOT NULL;
  ALTER TABLE "departures" ALTER COLUMN "destination_id" SET NOT NULL;
  ALTER TABLE "departures" ALTER COLUMN "zone" SET NOT NULL;
  ALTER TABLE "departures" ALTER COLUMN "days" SET NOT NULL;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_program" SET NOT NULL;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_mtpe" SET NOT NULL;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_destination_id" SET NOT NULL;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_zone" SET NOT NULL;
  ALTER TABLE "_departures_v" ALTER COLUMN "version_days" SET NOT NULL;
  ALTER TABLE "departures" DROP COLUMN "program_ref_id";
  ALTER TABLE "departures" DROP COLUMN "departure_key";
  ALTER TABLE "_departures_v" DROP COLUMN "version_program_ref_id";
  ALTER TABLE "_departures_v" DROP COLUMN "version_departure_key";
  ALTER TABLE "banners" DROP COLUMN "placement";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "programs_id";
  DROP TYPE "public"."enum_banners_placement";`)
}
