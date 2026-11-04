import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" ADD COLUMN "_objectkey" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
     IF EXISTS (SELECT 1 FROM "media" WHERE "_objectkey" IS NOT NULL AND "_objectkey" <> '') THEN
       RAISE EXCEPTION 'No se puede revertir mientras existan claves de archivos en R2. Respalda y concilia los archivos primero.';
     END IF;
   END $$;
   ALTER TABLE "media" DROP COLUMN "_objectkey";`)
}
