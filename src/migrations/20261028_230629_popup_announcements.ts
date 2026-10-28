import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_banners_popup_kind" AS ENUM('promotion', 'news');
  CREATE TYPE "public"."enum_banners_popup_frequency" AS ENUM('session', 'daily', 'always');
  ALTER TYPE "public"."enum_banners_placement" ADD VALUE 'popup';
  ALTER TABLE "banners" ALTER COLUMN "image_id" DROP NOT NULL;
  ALTER TABLE "banners" ALTER COLUMN "static_image_id" DROP NOT NULL;
  ALTER TABLE "banners" ADD COLUMN "title" varchar;
  ALTER TABLE "banners" ADD COLUMN "message" varchar;
  ALTER TABLE "banners" ADD COLUMN "popup_kind" "enum_banners_popup_kind" DEFAULT 'promotion';
  ALTER TABLE "banners" ADD COLUMN "button_label" varchar DEFAULT 'Conocer más';
  ALTER TABLE "banners" ADD COLUMN "popup_frequency" "enum_banners_popup_frequency" DEFAULT 'session';
  ALTER TABLE "banners" ADD COLUMN "popup_delay" numeric DEFAULT 2;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM "banners" WHERE "placement" = 'popup' OR "image_id" IS NULL OR "static_image_id" IS NULL) THEN
       RAISE EXCEPTION 'No se puede revertir: existen popups. Exporta y retira estos anuncios antes de revertir.';
     END IF;
   END $$;
   ALTER TABLE "banners" ALTER COLUMN "placement" SET DATA TYPE text;
  ALTER TABLE "banners" ALTER COLUMN "placement" SET DEFAULT 'hero'::text;
  DROP TYPE "public"."enum_banners_placement";
  CREATE TYPE "public"."enum_banners_placement" AS ENUM('hero', 'between-results', 'catalog-end');
  ALTER TABLE "banners" ALTER COLUMN "placement" SET DEFAULT 'hero'::"public"."enum_banners_placement";
  ALTER TABLE "banners" ALTER COLUMN "placement" SET DATA TYPE "public"."enum_banners_placement" USING "placement"::"public"."enum_banners_placement";
  ALTER TABLE "banners" ALTER COLUMN "image_id" SET NOT NULL;
  ALTER TABLE "banners" ALTER COLUMN "static_image_id" SET NOT NULL;
  ALTER TABLE "banners" DROP COLUMN "title";
  ALTER TABLE "banners" DROP COLUMN "message";
  ALTER TABLE "banners" DROP COLUMN "popup_kind";
  ALTER TABLE "banners" DROP COLUMN "button_label";
  ALTER TABLE "banners" DROP COLUMN "popup_frequency";
  ALTER TABLE "banners" DROP COLUMN "popup_delay";
  DROP TYPE "public"."enum_banners_popup_kind";
  DROP TYPE "public"."enum_banners_popup_frequency";`)
}
