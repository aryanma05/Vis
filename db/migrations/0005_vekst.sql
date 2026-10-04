CREATE TYPE "public"."contact_reason" AS ENUM('jobb', 'oppdrag', 'samarbeid', 'annet');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'contact';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'featured';--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_item" (
	"collection_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_collection_id_project_id_pk" PRIMARY KEY("collection_id","project_id")
);
--> statement-breakpoint
CREATE TABLE "contact_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"company_id" uuid,
	"reason" "contact_reason" DEFAULT 'annet' NOT NULL,
	"message" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_update" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL,
	"verified" boolean DEFAULT true,
	"failed_verification_count" integer DEFAULT 0,
	"locked_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "contact_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "digest_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "featured_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_request" ADD CONSTRAINT "contact_request_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_request" ADD CONSTRAINT "contact_request_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_update" ADD CONSTRAINT "project_update_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_owner_idx" ON "collection" USING btree ("owner_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "collection_item_project_idx" ON "collection_item" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "contact_request_recipient_idx" ON "contact_request" USING btree ("recipient_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "contact_request_sender_idx" ON "contact_request" USING btree ("sender_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "project_update_project_idx" ON "project_update" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "two_factor_user_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "project_featured_idx" ON "project" USING btree ("featured_at" DESC NULLS LAST);