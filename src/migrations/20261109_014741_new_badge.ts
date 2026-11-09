import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "departures" ADD COLUMN "new_badge" boolean DEFAULT false;
  ALTER TABLE "departures" ADD COLUMN "new_badge_label" varchar;
  ALTER TABLE "departures" ADD COLUMN "new_badge_until" timestamp(3) with time zone;
  ALTER TABLE "_departures_v" ADD COLUMN "version_new_badge" boolean DEFAULT false;
  ALTER TABLE "_departures_v" ADD COLUMN "version_new_badge_label" varchar;
  ALTER TABLE "_departures_v" ADD COLUMN "version_new_badge_until" timestamp(3) with time zone;
  ALTER TABLE "programs" ADD COLUMN "new_badge" boolean DEFAULT false;
  ALTER TABLE "programs" ADD COLUMN "new_badge_label" varchar DEFAULT 'NUEVO';
  ALTER TABLE "programs" ADD COLUMN "new_badge_until" timestamp(3) with time zone;
  ALTER TABLE "_programs_v" ADD COLUMN "version_new_badge" boolean DEFAULT false;
  ALTER TABLE "_programs_v" ADD COLUMN "version_new_badge_label" varchar DEFAULT 'NUEVO';
  ALTER TABLE "_programs_v" ADD COLUMN "version_new_badge_until" timestamp(3) with time zone;
  ALTER TABLE "banners" ADD COLUMN "countdown_enabled" boolean DEFAULT false;
  ALTER TABLE "banners" ADD COLUMN "countdown_ends_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM "programs" WHERE "new_badge" = true OR "new_badge_until" IS NOT NULL)
       OR EXISTS (SELECT 1 FROM "departures" WHERE "new_badge" = true OR "new_badge_label" IS NOT NULL OR "new_badge_until" IS NOT NULL)
       OR EXISTS (SELECT 1 FROM "banners" WHERE "countdown_enabled" = true OR "countdown_ends_at" IS NOT NULL) THEN
       RAISE EXCEPTION 'No se puede revertir: existen etiquetas «Nuevo» o contadores configurados en banners. Respalda y concilia los datos antes de eliminar columnas.';
     END IF;
   END $$;
   ALTER TABLE "departures" DROP COLUMN "new_badge";
  ALTER TABLE "departures" DROP COLUMN "new_badge_label";
  ALTER TABLE "departures" DROP COLUMN "new_badge_until";
  ALTER TABLE "_departures_v" DROP COLUMN "version_new_badge";
  ALTER TABLE "_departures_v" DROP COLUMN "version_new_badge_label";
  ALTER TABLE "_departures_v" DROP COLUMN "version_new_badge_until";
  ALTER TABLE "programs" DROP COLUMN "new_badge";
  ALTER TABLE "programs" DROP COLUMN "new_badge_label";
  ALTER TABLE "programs" DROP COLUMN "new_badge_until";
  ALTER TABLE "_programs_v" DROP COLUMN "version_new_badge";
  ALTER TABLE "_programs_v" DROP COLUMN "version_new_badge_label";
  ALTER TABLE "_programs_v" DROP COLUMN "version_new_badge_until";
  ALTER TABLE "banners" DROP COLUMN "countdown_enabled";
  ALTER TABLE "banners" DROP COLUMN "countdown_ends_at";`)
}
