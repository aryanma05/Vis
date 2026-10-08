CREATE TYPE "public"."company_invite_kind" AS ENUM('member', 'employee', 'owner');--> statement-breakpoint
CREATE TYPE "public"."company_invite_status" AS ENUM('pending', 'accepted', 'declined', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."message_template_kind" AS ENUM('takk', 'intervju', 'tilbud', 'avslag', 'generell');--> statement-breakpoint
CREATE TYPE "public"."review_recommendation" AS ENUM('ja', 'kanskje', 'nei');--> statement-breakpoint
ALTER TYPE "public"."company_role" ADD VALUE 'reviewer';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'company_invite';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'company_access';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'interview';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'talent';--> statement-breakpoint
ALTER TYPE "public"."report_target" ADD VALUE 'company';--> statement-breakpoint
ALTER TYPE "public"."report_target" ADD VALUE 'job';--> statement-breakpoint
CREATE TABLE "application_note" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"mention_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "application_review" (
	"application_id" uuid NOT NULL,
	"reviewer_id" text NOT NULL,
	"scores" jsonb NOT NULL,
	"recommendation" "review_recommendation" NOT NULL,
	"comment" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_review_application_id_reviewer_id_pk" PRIMARY KEY("application_id","reviewer_id")
);
--> statement-breakpoint
CREATE TABLE "company_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"subject_user_id" text,
	"label" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_block" (
	"user_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_block_user_id_company_id_pk" PRIMARY KEY("user_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "company_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" "company_invite_kind" NOT NULL,
	"role" "company_role",
	"title" text,
	"invited_user_id" text,
	"email" text,
	"token_hash" text,
	"invited_by_id" text,
	"status" "company_invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_invite_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "company_invite_target_chk" CHECK ((invited_user_id is null) <> (email is null))
);
--> statement-breakpoint
CREATE TABLE "company_message_template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" "message_template_kind" NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_slot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"host_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 45 NOT NULL,
	"location" text,
	"meeting_url" text,
	"application_id" uuid,
	"booked_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_view_day" (
	"job_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "job_view_day_job_id_day_pk" PRIMARY KEY("job_id","day")
);
--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "verified_domain" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "require_2fa" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "terms_accepted_by_id" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "retention_months" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "auto_reply" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "response_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "roi_settings" jsonb;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "perks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD COLUMN "hiring_process" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "company_employee" ADD COLUMN "invited_by_id" text;--> statement-breakpoint
ALTER TABLE "company_member" ADD COLUMN "show_on_page" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company_member" ADD COLUMN "invited_by_id" text;--> statement-breakpoint
ALTER TABLE "company_webhook" ADD COLUMN "created_by_id" text;--> statement-breakpoint
ALTER TABLE "company_webhook" ADD COLUMN "include_personal_data" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "replaced_paid_ad" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "scorecard_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "job" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_application" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() + interval '12 months' NOT NULL;--> statement-breakpoint
ALTER TABLE "job_application" ADD COLUMN "first_response_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_application" ADD COLUMN "hired_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "job_application" ADD COLUMN "agency_avoided" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "talent_list_member" ADD COLUMN "added_by_id" text;--> statement-breakpoint
ALTER TABLE "talent_list_member" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() + interval '12 months' NOT NULL;--> statement-breakpoint
ALTER TABLE "application_note" ADD CONSTRAINT "application_note_application_id_job_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_note" ADD CONSTRAINT "application_note_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_review" ADD CONSTRAINT "application_review_application_id_job_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_review" ADD CONSTRAINT "application_review_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_audit" ADD CONSTRAINT "company_audit_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_audit" ADD CONSTRAINT "company_audit_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_audit" ADD CONSTRAINT "company_audit_subject_user_id_user_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_block" ADD CONSTRAINT "company_block_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_block" ADD CONSTRAINT "company_block_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invite" ADD CONSTRAINT "company_invite_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invite" ADD CONSTRAINT "company_invite_invited_user_id_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_invite" ADD CONSTRAINT "company_invite_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_message_template" ADD CONSTRAINT "company_message_template_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_message_template" ADD CONSTRAINT "company_message_template_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_slot" ADD CONSTRAINT "interview_slot_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_slot" ADD CONSTRAINT "interview_slot_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_slot" ADD CONSTRAINT "interview_slot_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_slot" ADD CONSTRAINT "interview_slot_application_id_job_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_application"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_slot" ADD CONSTRAINT "interview_slot_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_view_day" ADD CONSTRAINT "job_view_day_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_note_application_idx" ON "application_note" USING btree ("application_id","created_at");--> statement-breakpoint
CREATE INDEX "company_audit_company_idx" ON "company_audit" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "company_audit_subject_idx" ON "company_audit" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "company_block_company_idx" ON "company_block" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_invite_company_idx" ON "company_invite" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "company_invite_user_idx" ON "company_invite" USING btree ("invited_user_id");--> statement-breakpoint
CREATE INDEX "company_invite_email_idx" ON "company_invite" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "company_invite_pending_user_uniq" ON "company_invite" USING btree ("company_id","kind","invited_user_id") WHERE status = 'pending' and invited_user_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "company_invite_pending_email_uniq" ON "company_invite" USING btree ("company_id","kind","email") WHERE status = 'pending' and email is not null;--> statement-breakpoint
CREATE INDEX "company_message_template_company_idx" ON "company_message_template" USING btree ("company_id","kind");--> statement-breakpoint
CREATE INDEX "interview_slot_job_idx" ON "interview_slot" USING btree ("job_id","starts_at");--> statement-breakpoint
CREATE INDEX "interview_slot_company_idx" ON "interview_slot" USING btree ("company_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "interview_slot_application_uniq" ON "interview_slot" USING btree ("application_id") WHERE application_id is not null;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_terms_accepted_by_id_user_id_fk" FOREIGN KEY ("terms_accepted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_employee" ADD CONSTRAINT "company_employee_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_member" ADD CONSTRAINT "company_member_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_webhook" ADD CONSTRAINT "company_webhook_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_list_member" ADD CONSTRAINT "talent_list_member_added_by_id_user_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_application_expires_idx" ON "job_application" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "talent_list_member_expires_idx" ON "talent_list_member" USING btree ("expires_at");--> statement-breakpoint
-- Eieren som laget siden vises fortsatt; alle andre medlemmer må velge det selv.
UPDATE "company_member" m SET "show_on_page" = true FROM "company" c
  WHERE c.id = m.company_id AND m.role = 'owner' AND c.created_by_id = m.user_id;--> statement-breakpoint
-- Ikke bryt eksisterende integrasjoner: webhooks som finnes fra før, sender fortsatt alt.
UPDATE "company_webhook" SET "include_personal_data" = true;--> statement-breakpoint
UPDATE "job" SET "closed_at" = "updated_at" WHERE "status" = 'closed';--> statement-breakpoint
-- Faste slettedatoer for søknadene, regnet ut fra stillingen (minst 30 dager frem).
UPDATE "job_application" a SET "expires_at" = GREATEST(LEAST(a.created_at + interval '12 months',
    CASE WHEN j.status = 'closed' THEN j.updated_at + interval '6 months'
         WHEN j.deadline < current_date THEN j.deadline::timestamptz + interval '6 months'
         ELSE a.created_at + interval '12 months' END), now() + interval '30 days')
  FROM "job" j WHERE j.id = a.job_id;--> statement-breakpoint
UPDATE "talent_list_member" SET "expires_at" = GREATEST("added_at" + interval '12 months', now() + interval '30 days');--> statement-breakpoint
-- Det gamle felles notatet blir det første notatet i tråden (uten forfatter).
INSERT INTO "application_note" ("application_id","author_id","body","created_at")
  SELECT "id", NULL, "note", "updated_at" FROM "job_application" WHERE "note" IS NOT NULL AND "status" <> 'trukket';--> statement-breakpoint
-- Trukne søknader minimeres med en gang og slettes om 30 dager (som når noen trekker søknaden nå).
UPDATE "job_application" SET "message" = NULL, "note" = NULL, "project_ids" = '[]'::jsonb,
    "expires_at" = LEAST("expires_at", now() + interval '30 days') WHERE "status" = 'trukket';