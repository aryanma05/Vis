CREATE TYPE "public"."application_status" AS ENUM('ny', 'intervju', 'tilbud', 'avslag', 'trukket');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'application';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'employee';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'challenge';--> statement-breakpoint
CREATE TABLE "challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"reward" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deadline" date,
	"status" "challenge_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"note" text,
	"highlighted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_employee" (
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_employee_company_id_user_id_pk" PRIMARY KEY("company_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "job_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "application_status" DEFAULT 'ny' NOT NULL,
	"message" text,
	"project_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_search" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"created_by_id" text,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"notify" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_notified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "apply_mode" text DEFAULT 'ekstern' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "visible_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "study_program" text;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "graduation_year" integer;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_entry" ADD CONSTRAINT "challenge_entry_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_entry" ADD CONSTRAINT "challenge_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_entry" ADD CONSTRAINT "challenge_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_employee" ADD CONSTRAINT "company_employee_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_employee" ADD CONSTRAINT "company_employee_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_application" ADD CONSTRAINT "job_application_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_application" ADD CONSTRAINT "job_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_company_idx" ON "challenge" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "challenge_list_idx" ON "challenge" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_entry_user_uniq" ON "challenge_entry" USING btree ("challenge_id","user_id");--> statement-breakpoint
CREATE INDEX "challenge_entry_challenge_idx" ON "challenge_entry" USING btree ("challenge_id","created_at");--> statement-breakpoint
CREATE INDEX "company_employee_user_idx" ON "company_employee" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_application_job_user_uniq" ON "job_application" USING btree ("job_id","user_id");--> statement-breakpoint
CREATE INDEX "job_application_job_idx" ON "job_application" USING btree ("job_id","status");--> statement-breakpoint
CREATE INDEX "job_application_user_idx" ON "job_application" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "saved_search_company_idx" ON "saved_search" USING btree ("company_id");--> statement-breakpoint
-- De som allerede er synlige for bedrifter regnes som synlige fra sist profilen ble endret.
UPDATE "profile" SET "visible_since" = "updated_at" WHERE "visible_to_companies" = true;