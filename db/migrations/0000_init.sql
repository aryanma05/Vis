CREATE TYPE "public"."cv_import_status" AS ENUM('parsed', 'applied', 'discarded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."project_source" AS ENUM('manual', 'github');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cv_education" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"institution" text NOT NULL,
	"degree" text,
	"field_of_study" text,
	"start_date" varchar(7),
	"end_date" varchar(7),
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cv_experience" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"organization" text NOT NULL,
	"location" text,
	"start_date" varchar(7),
	"end_date" varchar(7),
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cv_import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"status" "cv_import_status" NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cv_skill" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"headline" text,
	"bio" text,
	"location" text,
	"website_url" text,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"description" text DEFAULT '' NOT NULL,
	"repo_url" text,
	"demo_url" text,
	"project_date" varchar(7),
	"status" "project_status" DEFAULT 'published' NOT NULL,
	"source" "project_source" DEFAULT 'manual' NOT NULL,
	"github_repo_id" bigint,
	"github_full_name" text,
	"github_synced_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', coalesce("title", '')), 'A') || setweight(to_tsvector('simple', coalesce("summary", '')), 'B') || setweight(to_tsvector('simple', coalesce("description", '')), 'C')) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"url" text NOT NULL,
	"storage_key" text,
	"alt" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_tag" (
	"project_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_tag_project_id_tag_id_pk" PRIMARY KEY("project_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text NOT NULL,
	"display_username" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_education" ADD CONSTRAINT "cv_education_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_experience" ADD CONSTRAINT "cv_experience_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_import" ADD CONSTRAINT "cv_import_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_skill" ADD CONSTRAINT "cv_skill_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_image" ADD CONSTRAINT "project_image_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag" ADD CONSTRAINT "project_tag_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tag" ADD CONSTRAINT "project_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_uniq" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "cv_education_user_idx" ON "cv_education" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "cv_experience_user_idx" ON "cv_experience" USING btree ("user_id","position");--> statement-breakpoint
CREATE INDEX "cv_import_user_idx" ON "cv_import" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cv_skill_user_idx" ON "cv_skill" USING btree ("user_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "cv_skill_user_name_uniq" ON "cv_skill" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "project_owner_idx" ON "project" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "project_feed_idx" ON "project" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "project_owner_github_repo_uniq" ON "project" USING btree ("owner_id","github_repo_id");--> statement-breakpoint
CREATE INDEX "project_search_idx" ON "project" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "project_image_project_idx" ON "project_image" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "project_tag_tag_idx" ON "project_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");