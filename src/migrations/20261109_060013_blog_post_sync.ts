import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE "settings_blog_posts" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "source_id" varchar NOT NULL,
      "title" varchar NOT NULL,
      "category" varchar NOT NULL,
      "date_label" varchar NOT NULL,
      "href" varchar NOT NULL,
      "image_url" varchar NOT NULL
    );

    ALTER TABLE "settings" ADD COLUMN "blog_last_synced_at" timestamp(3) with time zone;
    ALTER TABLE "settings_blog_posts" ADD CONSTRAINT "settings_blog_posts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "settings_blog_posts_order_idx" ON "settings_blog_posts" USING btree ("_order");
    CREATE INDEX "settings_blog_posts_parent_id_idx" ON "settings_blog_posts" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE "settings_blog_posts" CASCADE;
    ALTER TABLE "settings" DROP COLUMN "blog_last_synced_at";`)
}
