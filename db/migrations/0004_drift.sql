CREATE TABLE "error_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"event" text NOT NULL,
	"message" text NOT NULL,
	"digest" text,
	"path" text,
	"stack" text,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_bucket" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "error_event" ADD CONSTRAINT "error_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "error_event_created_idx" ON "error_event" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "rate_bucket_window_idx" ON "rate_bucket" USING btree ("window_start");