import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  CREATE TYPE "public"."enum_departures_currency" AS ENUM('USD', 'PEN');
  CREATE TYPE "public"."enum_departures_status" AS ENUM('draft', 'published', 'withdrawn');
  CREATE TYPE "public"."enum_departures_withdrawal_reason" AS ENUM('request', 'sold-out', 'price-change', 'other', 'automatic');
  CREATE TYPE "public"."enum__departures_v_version_currency" AS ENUM('USD', 'PEN');
  CREATE TYPE "public"."enum__departures_v_version_status" AS ENUM('draft', 'published', 'withdrawn');
  CREATE TYPE "public"."enum__departures_v_version_withdrawal_reason" AS ENUM('request', 'sold-out', 'price-change', 'other', 'automatic');
  CREATE TYPE "public"."enum_audit_log_event" AS ENUM('created', 'updated', 'withdrawn', 'reactivated');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"role" "enum_users_role" DEFAULT 'editor' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "departures" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stable_id" varchar,
  	"program" varchar NOT NULL,
  	"mtpe" varchar NOT NULL,
  	"destination_id" integer NOT NULL,
  	"zone" varchar NOT NULL,
  	"origin_id" integer NOT NULL,
  	"cruise_line_id" integer,
  	"price" numeric NOT NULL,
  	"currency" "enum_departures_currency" DEFAULT 'USD' NOT NULL,
  	"price_condition" varchar DEFAULT 'Por persona en habitación doble' NOT NULL,
  	"priority" numeric DEFAULT 0,
  	"travel_date" varchar NOT NULL,
  	"days" numeric NOT NULL,
  	"nights" numeric,
  	"advance_days" numeric DEFAULT 30 NOT NULL,
  	"withdrawal_at" timestamp(3) with time zone,
  	"flyer_id" integer,
  	"flyer_source_url" varchar,
  	"flyer_download_warning" varchar,
  	"booking_url" varchar,
  	"description_url" varchar,
  	"status" "enum_departures_status" DEFAULT 'draft' NOT NULL,
  	"review_confirmed" boolean DEFAULT false,
  	"withdrawal_reason" "enum_departures_withdrawal_reason",
  	"withdrawal_note" varchar,
  	"retired_at" timestamp(3) with time zone,
  	"retired_by_id" integer,
  	"source_key" varchar,
  	"source_sheet" varchar,
  	"source_ref" varchar,
  	"source_retirement_date" varchar,
  	"source_retirement_raw" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "departures_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"campaigns_id" integer
  );
  
  CREATE TABLE "_departures_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_stable_id" varchar,
  	"version_program" varchar NOT NULL,
  	"version_mtpe" varchar NOT NULL,
  	"version_destination_id" integer NOT NULL,
  	"version_zone" varchar NOT NULL,
  	"version_origin_id" integer NOT NULL,
  	"version_cruise_line_id" integer,
  	"version_price" numeric NOT NULL,
  	"version_currency" "enum__departures_v_version_currency" DEFAULT 'USD' NOT NULL,
  	"version_price_condition" varchar DEFAULT 'Por persona en habitación doble' NOT NULL,
  	"version_priority" numeric DEFAULT 0,
  	"version_travel_date" varchar NOT NULL,
  	"version_days" numeric NOT NULL,
  	"version_nights" numeric,
  	"version_advance_days" numeric DEFAULT 30 NOT NULL,
  	"version_withdrawal_at" timestamp(3) with time zone,
  	"version_flyer_id" integer,
  	"version_flyer_source_url" varchar,
  	"version_flyer_download_warning" varchar,
  	"version_booking_url" varchar,
  	"version_description_url" varchar,
  	"version_status" "enum__departures_v_version_status" DEFAULT 'draft' NOT NULL,
  	"version_review_confirmed" boolean DEFAULT false,
  	"version_withdrawal_reason" "enum__departures_v_version_withdrawal_reason",
  	"version_withdrawal_note" varchar,
  	"version_retired_at" timestamp(3) with time zone,
  	"version_retired_by_id" integer,
  	"version_source_key" varchar,
  	"version_source_sheet" varchar,
  	"version_source_ref" varchar,
  	"version_source_retirement_date" varchar,
  	"version_source_retirement_raw" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_departures_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"campaigns_id" integer
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"source_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric
  );
  
  CREATE TABLE "campaigns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "banners" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"static_image_id" integer NOT NULL,
  	"mobile_image_id" integer,
  	"alt" varchar NOT NULL,
  	"href" varchar,
  	"order" numeric DEFAULT 0,
  	"enabled" boolean DEFAULT false,
  	"starts_at" timestamp(3) with time zone,
  	"ends_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "destinations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "origins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cruise_lines" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"departure_id" varchar NOT NULL,
  	"program" varchar NOT NULL,
  	"event" "enum_audit_log_event" NOT NULL,
  	"actor_id" integer,
  	"actor_label" varchar NOT NULL,
  	"changes" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"departures_id" integer,
  	"media_id" integer,
  	"campaigns_id" integer,
  	"banners_id" integer,
  	"destinations_id" integer,
  	"origins_id" integer,
  	"cruise_lines_id" integer,
  	"audit_log_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"contact_url" varchar DEFAULT 'https://api.whatsapp.com/send?phone=51973473808' NOT NULL,
  	"contact_label" varchar DEFAULT 'Equipo comercial' NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "departures" ADD CONSTRAINT "departures_destination_id_destinations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "departures" ADD CONSTRAINT "departures_origin_id_origins_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."origins"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "departures" ADD CONSTRAINT "departures_cruise_line_id_cruise_lines_id_fk" FOREIGN KEY ("cruise_line_id") REFERENCES "public"."cruise_lines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "departures" ADD CONSTRAINT "departures_flyer_id_media_id_fk" FOREIGN KEY ("flyer_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "departures" ADD CONSTRAINT "departures_retired_by_id_users_id_fk" FOREIGN KEY ("retired_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "departures_rels" ADD CONSTRAINT "departures_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."departures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "departures_rels" ADD CONSTRAINT "departures_rels_campaigns_fk" FOREIGN KEY ("campaigns_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_departures_v" ADD CONSTRAINT "_departures_v_parent_id_departures_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."departures"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_departures_v" ADD CONSTRAINT "_departures_v_version_destination_id_destinations_id_fk" FOREIGN KEY ("version_destination_id") REFERENCES "public"."destinations"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_departures_v" ADD CONSTRAINT "_departures_v_version_origin_id_origins_id_fk" FOREIGN KEY ("version_origin_id") REFERENCES "public"."origins"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_departures_v" ADD CONSTRAINT "_departures_v_version_cruise_line_id_cruise_lines_id_fk" FOREIGN KEY ("version_cruise_line_id") REFERENCES "public"."cruise_lines"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_departures_v" ADD CONSTRAINT "_departures_v_version_flyer_id_media_id_fk" FOREIGN KEY ("version_flyer_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_departures_v" ADD CONSTRAINT "_departures_v_version_retired_by_id_users_id_fk" FOREIGN KEY ("version_retired_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_departures_v_rels" ADD CONSTRAINT "_departures_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_departures_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_departures_v_rels" ADD CONSTRAINT "_departures_v_rels_campaigns_fk" FOREIGN KEY ("campaigns_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_static_image_id_media_id_fk" FOREIGN KEY ("static_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_mobile_image_id_media_id_fk" FOREIGN KEY ("mobile_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_departures_fk" FOREIGN KEY ("departures_id") REFERENCES "public"."departures"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaigns_fk" FOREIGN KEY ("campaigns_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_banners_fk" FOREIGN KEY ("banners_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_destinations_fk" FOREIGN KEY ("destinations_id") REFERENCES "public"."destinations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_origins_fk" FOREIGN KEY ("origins_id") REFERENCES "public"."origins"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cruise_lines_fk" FOREIGN KEY ("cruise_lines_id") REFERENCES "public"."cruise_lines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_audit_log_fk" FOREIGN KEY ("audit_log_id") REFERENCES "public"."audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "departures_stable_id_idx" ON "departures" USING btree ("stable_id");
  CREATE INDEX "departures_program_idx" ON "departures" USING btree ("program");
  CREATE INDEX "departures_mtpe_idx" ON "departures" USING btree ("mtpe");
  CREATE INDEX "departures_destination_idx" ON "departures" USING btree ("destination_id");
  CREATE INDEX "departures_zone_idx" ON "departures" USING btree ("zone");
  CREATE INDEX "departures_origin_idx" ON "departures" USING btree ("origin_id");
  CREATE INDEX "departures_cruise_line_idx" ON "departures" USING btree ("cruise_line_id");
  CREATE INDEX "departures_travel_date_idx" ON "departures" USING btree ("travel_date");
  CREATE INDEX "departures_withdrawal_at_idx" ON "departures" USING btree ("withdrawal_at");
  CREATE INDEX "departures_flyer_idx" ON "departures" USING btree ("flyer_id");
  CREATE INDEX "departures_status_idx" ON "departures" USING btree ("status");
  CREATE INDEX "departures_retired_by_idx" ON "departures" USING btree ("retired_by_id");
  CREATE UNIQUE INDEX "departures_source_key_idx" ON "departures" USING btree ("source_key");
  CREATE INDEX "departures_updated_at_idx" ON "departures" USING btree ("updated_at");
  CREATE INDEX "departures_created_at_idx" ON "departures" USING btree ("created_at");
  CREATE INDEX "departures_rels_order_idx" ON "departures_rels" USING btree ("order");
  CREATE INDEX "departures_rels_parent_idx" ON "departures_rels" USING btree ("parent_id");
  CREATE INDEX "departures_rels_path_idx" ON "departures_rels" USING btree ("path");
  CREATE INDEX "departures_rels_campaigns_id_idx" ON "departures_rels" USING btree ("campaigns_id");
  CREATE INDEX "_departures_v_parent_idx" ON "_departures_v" USING btree ("parent_id");
  CREATE INDEX "_departures_v_version_version_stable_id_idx" ON "_departures_v" USING btree ("version_stable_id");
  CREATE INDEX "_departures_v_version_version_program_idx" ON "_departures_v" USING btree ("version_program");
  CREATE INDEX "_departures_v_version_version_mtpe_idx" ON "_departures_v" USING btree ("version_mtpe");
  CREATE INDEX "_departures_v_version_version_destination_idx" ON "_departures_v" USING btree ("version_destination_id");
  CREATE INDEX "_departures_v_version_version_zone_idx" ON "_departures_v" USING btree ("version_zone");
  CREATE INDEX "_departures_v_version_version_origin_idx" ON "_departures_v" USING btree ("version_origin_id");
  CREATE INDEX "_departures_v_version_version_cruise_line_idx" ON "_departures_v" USING btree ("version_cruise_line_id");
  CREATE INDEX "_departures_v_version_version_travel_date_idx" ON "_departures_v" USING btree ("version_travel_date");
  CREATE INDEX "_departures_v_version_version_withdrawal_at_idx" ON "_departures_v" USING btree ("version_withdrawal_at");
  CREATE INDEX "_departures_v_version_version_flyer_idx" ON "_departures_v" USING btree ("version_flyer_id");
  CREATE INDEX "_departures_v_version_version_status_idx" ON "_departures_v" USING btree ("version_status");
  CREATE INDEX "_departures_v_version_version_retired_by_idx" ON "_departures_v" USING btree ("version_retired_by_id");
  CREATE INDEX "_departures_v_version_version_source_key_idx" ON "_departures_v" USING btree ("version_source_key");
  CREATE INDEX "_departures_v_version_version_updated_at_idx" ON "_departures_v" USING btree ("version_updated_at");
  CREATE INDEX "_departures_v_version_version_created_at_idx" ON "_departures_v" USING btree ("version_created_at");
  CREATE INDEX "_departures_v_created_at_idx" ON "_departures_v" USING btree ("created_at");
  CREATE INDEX "_departures_v_updated_at_idx" ON "_departures_v" USING btree ("updated_at");
  CREATE INDEX "_departures_v_rels_order_idx" ON "_departures_v_rels" USING btree ("order");
  CREATE INDEX "_departures_v_rels_parent_idx" ON "_departures_v_rels" USING btree ("parent_id");
  CREATE INDEX "_departures_v_rels_path_idx" ON "_departures_v_rels" USING btree ("path");
  CREATE INDEX "_departures_v_rels_campaigns_id_idx" ON "_departures_v_rels" USING btree ("campaigns_id");
  CREATE UNIQUE INDEX "media_source_url_idx" ON "media" USING btree ("source_url");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE UNIQUE INDEX "campaigns_slug_idx" ON "campaigns" USING btree ("slug");
  CREATE INDEX "campaigns_updated_at_idx" ON "campaigns" USING btree ("updated_at");
  CREATE INDEX "campaigns_created_at_idx" ON "campaigns" USING btree ("created_at");
  CREATE INDEX "banners_image_idx" ON "banners" USING btree ("image_id");
  CREATE INDEX "banners_static_image_idx" ON "banners" USING btree ("static_image_id");
  CREATE INDEX "banners_mobile_image_idx" ON "banners" USING btree ("mobile_image_id");
  CREATE INDEX "banners_updated_at_idx" ON "banners" USING btree ("updated_at");
  CREATE INDEX "banners_created_at_idx" ON "banners" USING btree ("created_at");
  CREATE UNIQUE INDEX "destinations_name_idx" ON "destinations" USING btree ("name");
  CREATE INDEX "destinations_updated_at_idx" ON "destinations" USING btree ("updated_at");
  CREATE INDEX "destinations_created_at_idx" ON "destinations" USING btree ("created_at");
  CREATE UNIQUE INDEX "origins_name_idx" ON "origins" USING btree ("name");
  CREATE INDEX "origins_updated_at_idx" ON "origins" USING btree ("updated_at");
  CREATE INDEX "origins_created_at_idx" ON "origins" USING btree ("created_at");
  CREATE UNIQUE INDEX "cruise_lines_name_idx" ON "cruise_lines" USING btree ("name");
  CREATE INDEX "cruise_lines_updated_at_idx" ON "cruise_lines" USING btree ("updated_at");
  CREATE INDEX "cruise_lines_created_at_idx" ON "cruise_lines" USING btree ("created_at");
  CREATE INDEX "audit_log_departure_id_idx" ON "audit_log" USING btree ("departure_id");
  CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");
  CREATE INDEX "audit_log_updated_at_idx" ON "audit_log" USING btree ("updated_at");
  CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_departures_id_idx" ON "payload_locked_documents_rels" USING btree ("departures_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("campaigns_id");
  CREATE INDEX "payload_locked_documents_rels_banners_id_idx" ON "payload_locked_documents_rels" USING btree ("banners_id");
  CREATE INDEX "payload_locked_documents_rels_destinations_id_idx" ON "payload_locked_documents_rels" USING btree ("destinations_id");
  CREATE INDEX "payload_locked_documents_rels_origins_id_idx" ON "payload_locked_documents_rels" USING btree ("origins_id");
  CREATE INDEX "payload_locked_documents_rels_cruise_lines_id_idx" ON "payload_locked_documents_rels" USING btree ("cruise_lines_id");
  CREATE INDEX "payload_locked_documents_rels_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("audit_log_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "departures" CASCADE;
  DROP TABLE "departures_rels" CASCADE;
  DROP TABLE "_departures_v" CASCADE;
  DROP TABLE "_departures_v_rels" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "campaigns" CASCADE;
  DROP TABLE "banners" CASCADE;
  DROP TABLE "destinations" CASCADE;
  DROP TABLE "origins" CASCADE;
  DROP TABLE "cruise_lines" CASCADE;
  DROP TABLE "audit_log" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "settings" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_departures_currency";
  DROP TYPE "public"."enum_departures_status";
  DROP TYPE "public"."enum_departures_withdrawal_reason";
  DROP TYPE "public"."enum__departures_v_version_currency";
  DROP TYPE "public"."enum__departures_v_version_status";
  DROP TYPE "public"."enum__departures_v_version_withdrawal_reason";
  DROP TYPE "public"."enum_audit_log_event";`)
}
