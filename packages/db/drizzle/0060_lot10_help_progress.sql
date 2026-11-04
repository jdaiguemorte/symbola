CREATE TYPE "hub"."help_progress_status" AS ENUM('started', 'postponed', 'completed');--> statement-breakpoint
CREATE TABLE "hub"."help_progress" (
	"user_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"status" "hub"."help_progress_status" NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"context" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "help_progress_user_id_item_key_pk" PRIMARY KEY("user_id","item_key")
);
--> statement-breakpoint
ALTER TABLE "hub"."help_progress" ADD CONSTRAINT "help_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;