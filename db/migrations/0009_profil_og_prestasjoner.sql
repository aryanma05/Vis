CREATE TABLE "user_achievement" (
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"tier" integer DEFAULT 1 NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen_at" timestamp with time zone,
	CONSTRAINT "user_achievement_user_id_key_pk" PRIMARY KEY("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "banner" jsonb;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "pet" jsonb;--> statement-breakpoint
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;