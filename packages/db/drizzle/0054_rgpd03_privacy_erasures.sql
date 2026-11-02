CREATE TYPE "hub"."privacy_erasure_status" AS ENUM('pending', 'partial', 'completed');--> statement-breakpoint
CREATE TABLE "hub"."privacy_erasures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"status" "hub"."privacy_erasure_status" DEFAULT 'pending' NOT NULL,
	"items" jsonb NOT NULL,
	"acks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "signed_quote_retention_months" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."privacy_erasures" ADD CONSTRAINT "privacy_erasures_request_id_privacy_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hub"."privacy_requests"("id") ON DELETE no action ON UPDATE no action;