import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "programs" ADD COLUMN "video_url" varchar;
  ALTER TABLE "_programs_v" ADD COLUMN "version_video_url" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM "programs" WHERE NULLIF("video_url", '') IS NOT NULL)
       OR EXISTS (SELECT 1 FROM "_programs_v" WHERE NULLIF("version_video_url", '') IS NOT NULL) THEN
       RAISE EXCEPTION 'No se puede revertir: existen enlaces de video guardados. Respalda y concilia esos datos antes de eliminar las columnas.';
     END IF;
   END $$;
   ALTER TABLE "programs" DROP COLUMN "video_url";
  ALTER TABLE "_programs_v" DROP COLUMN "version_video_url";`)
}
