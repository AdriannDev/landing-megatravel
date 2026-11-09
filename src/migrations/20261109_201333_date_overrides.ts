import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "departures" ADD COLUMN "destination_override_id" integer;
  ALTER TABLE "departures" ADD COLUMN "booking_url_override" varchar;
  ALTER TABLE "_departures_v" ADD COLUMN "version_destination_override_id" integer;
  ALTER TABLE "_departures_v" ADD COLUMN "version_booking_url_override" varchar;
  ALTER TABLE "departures" ADD CONSTRAINT "departures_destination_override_id_destinations_id_fk" FOREIGN KEY ("destination_override_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_departures_v" ADD CONSTRAINT "_departures_v_version_destination_override_id_destinations_id_fk" FOREIGN KEY ("version_destination_override_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "departures_destination_override_idx" ON "departures" USING btree ("destination_override_id");
  CREATE INDEX "_departures_v_version_version_destination_override_idx" ON "_departures_v" USING btree ("version_destination_override_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM "departures" WHERE "destination_override_id" IS NOT NULL OR NULLIF("booking_url_override", '') IS NOT NULL)
       OR EXISTS (SELECT 1 FROM "_departures_v" WHERE "version_destination_override_id" IS NOT NULL OR NULLIF("version_booking_url_override", '') IS NOT NULL) THEN
       RAISE EXCEPTION 'No se puede revertir: existen destinos o enlaces específicos por fecha. Respalda y concilia esos datos antes de eliminar las columnas.';
     END IF;
   END $$;
   ALTER TABLE "departures" DROP CONSTRAINT "departures_destination_override_id_destinations_id_fk";
  
  ALTER TABLE "_departures_v" DROP CONSTRAINT "_departures_v_version_destination_override_id_destinations_id_fk";
  
  DROP INDEX "departures_destination_override_idx";
  DROP INDEX "_departures_v_version_version_destination_override_idx";
  ALTER TABLE "departures" DROP COLUMN "destination_override_id";
  ALTER TABLE "departures" DROP COLUMN "booking_url_override";
  ALTER TABLE "_departures_v" DROP COLUMN "version_destination_override_id";
  ALTER TABLE "_departures_v" DROP COLUMN "version_booking_url_override";`)
}
