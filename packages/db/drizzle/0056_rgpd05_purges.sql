CREATE TABLE "hub"."privacy_purges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period" text NOT NULL,
	"status" "hub"."privacy_erasure_status" DEFAULT 'pending' NOT NULL,
	"lines" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"acks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "last_login_at" timestamp with time zone;