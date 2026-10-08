CREATE TYPE "public"."partner_commitment" AS ENUM('hele', 'del', 'moro');--> statement-breakpoint
CREATE TYPE "public"."partner_request_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."partner_stage" AS ENUM('ide', 'pabegynt');--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'partner_request';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'partner_accepted';--> statement-breakpoint
CREATE TABLE "partner_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"stage" "partner_stage" DEFAULT 'ide' NOT NULL,
	"needs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"commitments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"sender_id" text NOT NULL,
	"commitment" "partner_commitment" NOT NULL,
	"message" text NOT NULL,
	"status" "partner_request_status" DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "partner_request_id" uuid;--> statement-breakpoint
ALTER TABLE "partner_post" ADD CONSTRAINT "partner_post_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_post" ADD CONSTRAINT "partner_post_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_request" ADD CONSTRAINT "partner_request_post_id_partner_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."partner_post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_request" ADD CONSTRAINT "partner_request_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_post_owner_idx" ON "partner_post" USING btree ("owner_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "partner_post_list_idx" ON "partner_post" USING btree ("closed_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "partner_post_project_idx" ON "partner_post" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partner_request_post_sender_uniq" ON "partner_request" USING btree ("post_id","sender_id");--> statement-breakpoint
CREATE INDEX "partner_request_sender_idx" ON "partner_request" USING btree ("sender_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_partner_request_id_partner_request_id_fk" FOREIGN KEY ("partner_request_id") REFERENCES "public"."partner_request"("id") ON DELETE cascade ON UPDATE no action;