import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "settings_blog_posts" ALTER COLUMN "date_label" DROP NOT NULL;
   ALTER TABLE "settings_blog_posts" ADD COLUMN "image_id" integer;
  ALTER TABLE "settings" ADD COLUMN "featured_departure1_id" integer;
  ALTER TABLE "settings" ADD COLUMN "featured_departure2_id" integer;
  ALTER TABLE "settings_blog_posts" ADD CONSTRAINT "settings_blog_posts_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "settings" ADD CONSTRAINT "settings_featured_departure1_id_departures_id_fk" FOREIGN KEY ("featured_departure1_id") REFERENCES "public"."departures"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "settings" ADD CONSTRAINT "settings_featured_departure2_id_departures_id_fk" FOREIGN KEY ("featured_departure2_id") REFERENCES "public"."departures"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "settings_blog_posts_image_idx" ON "settings_blog_posts" USING btree ("image_id");
  CREATE INDEX "settings_featured_departure1_idx" ON "settings" USING btree ("featured_departure1_id");
  CREATE INDEX "settings_featured_departure2_idx" ON "settings" USING btree ("featured_departure2_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM "settings" WHERE "featured_departure1_id" IS NOT NULL OR "featured_departure2_id" IS NOT NULL)
       OR EXISTS (SELECT 1 FROM "settings_blog_posts" WHERE "image_id" IS NOT NULL) THEN
       RAISE EXCEPTION 'No se puede revertir: existen destacados o miniaturas de Mega Blog. Conserva esas selecciones antes de eliminar las columnas.';
     END IF;
   END $$;
   UPDATE "settings_blog_posts" SET "date_label" = '' WHERE "date_label" IS NULL;
   ALTER TABLE "settings_blog_posts" ALTER COLUMN "date_label" SET NOT NULL;
   ALTER TABLE "settings_blog_posts" DROP CONSTRAINT "settings_blog_posts_image_id_media_id_fk";

  ALTER TABLE "settings" DROP CONSTRAINT "settings_featured_departure1_id_departures_id_fk";

  ALTER TABLE "settings" DROP CONSTRAINT "settings_featured_departure2_id_departures_id_fk";

  DROP INDEX "settings_blog_posts_image_idx";
  DROP INDEX "settings_featured_departure1_idx";
  DROP INDEX "settings_featured_departure2_idx";
  ALTER TABLE "settings_blog_posts" DROP COLUMN "image_id";
  ALTER TABLE "settings" DROP COLUMN "featured_departure1_id";
  ALTER TABLE "settings" DROP COLUMN "featured_departure2_id";`)
}
