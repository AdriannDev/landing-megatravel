import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_banners_popup_format" AS ENUM('text', 'image');
    ALTER TABLE "banners" ADD COLUMN "popup_format" "public"."enum_banners_popup_format" DEFAULT 'text';
    ALTER TABLE "banners" ADD COLUMN "popup_label" varchar;
    ALTER TABLE "banners" ADD COLUMN "popup_secondary_label" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM "banners" WHERE "popup_format" = 'image' OR NULLIF("popup_label", '') IS NOT NULL OR NULLIF("popup_secondary_label", '') IS NOT NULL) THEN
        RAISE EXCEPTION 'No se puede revertir mientras existan popups de solo imagen o textos personalizados.';
      END IF;
    END $$;
    ALTER TABLE "banners" DROP COLUMN "popup_format";
    ALTER TABLE "banners" DROP COLUMN "popup_label";
    ALTER TABLE "banners" DROP COLUMN "popup_secondary_label";
    DROP TYPE "public"."enum_banners_popup_format";
  `)
}
