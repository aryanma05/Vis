CREATE TABLE "stored_file" (
	"key" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stored_file" ADD CONSTRAINT "stored_file_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stored_file_owner_idx" ON "stored_file" USING btree ("owner_id");