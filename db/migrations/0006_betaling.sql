CREATE TYPE "public"."billing_owner" AS ENUM('user', 'company');--> statement-breakpoint
CREATE TYPE "public"."company_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'published', 'closed');--> statement-breakpoint
CREATE TYPE "public"."plan_kind" AS ENUM('pro', 'business');--> statement-breakpoint
CREATE TABLE "billing_customer" (
	"owner_type" "billing_owner" NOT NULL,
	"owner_id" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customer_owner_type_owner_id_pk" PRIMARY KEY("owner_type","owner_id"),
	CONSTRAINT "billing_customer_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"logo_url" text,
	"about" text,
	"location" text,
	"size" text,
	"verified_at" timestamp with time zone,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "company_member" (
	"company_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "company_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_member_company_id_user_id_pk" PRIMARY KEY("company_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "custom_domain" (
	"domain" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_domain_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"location" text,
	"remote" text DEFAULT 'nei' NOT NULL,
	"type" text DEFAULT 'fulltid' NOT NULL,
	"apply_url" text,
	"apply_email" text,
	"deadline" date,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"apply_clicks" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_grant" (
	"owner_type" "billing_owner" NOT NULL,
	"owner_id" text NOT NULL,
	"plan" "plan_kind" NOT NULL,
	"until" timestamp with time zone,
	"note" text,
	"granted_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_grant_owner_type_owner_id_pk" PRIMARY KEY("owner_type","owner_id")
);
--> statement-breakpoint
CREATE TABLE "profile_visit" (
	"profile_user_id" text NOT NULL,
	"viewer_id" text NOT NULL,
	"visits" integer DEFAULT 1 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_visit_profile_user_id_viewer_id_pk" PRIMARY KEY("profile_user_id","viewer_id")
);
--> statement-breakpoint
CREATE TABLE "stripe_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_type" "billing_owner" NOT NULL,
	"owner_id" text NOT NULL,
	"plan" "plan_kind" NOT NULL,
	"price_id" text,
	"status" text NOT NULL,
	"interval" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "talent_list_member" (
	"list_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"note" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "talent_list_member_list_id_user_id_pk" PRIMARY KEY("list_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "hide_visits" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "visible_to_companies" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "hide_branding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_member" ADD CONSTRAINT "company_member_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_member" ADD CONSTRAINT "company_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_domain" ADD CONSTRAINT "custom_domain_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_grant" ADD CONSTRAINT "plan_grant_granted_by_id_user_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_visit" ADD CONSTRAINT "profile_visit_profile_user_id_user_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_visit" ADD CONSTRAINT "profile_visit_viewer_id_user_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_list" ADD CONSTRAINT "talent_list_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_list_member" ADD CONSTRAINT "talent_list_member_list_id_talent_list_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."talent_list"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "talent_list_member" ADD CONSTRAINT "talent_list_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_member_user_idx" ON "company_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "job_company_idx" ON "job" USING btree ("company_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "job_list_idx" ON "job" USING btree ("status","published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "profile_visit_recent_idx" ON "profile_visit" USING btree ("profile_user_id","last_seen_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "subscription_owner_idx" ON "subscription" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "talent_list_company_idx" ON "talent_list" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "contact_request" ADD CONSTRAINT "contact_request_company_id_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."company"("id") ON DELETE set null ON UPDATE no action;