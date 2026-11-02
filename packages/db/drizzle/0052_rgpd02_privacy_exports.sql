CREATE TABLE "hub"."privacy_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid,
	"record_count" integer NOT NULL,
	"pdf_key" text NOT NULL,
	"archive_key" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"purged_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "privacy_export_retention_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."privacy_exports" ADD CONSTRAINT "privacy_exports_request_id_privacy_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "hub"."privacy_requests"("id") ON DELETE no action ON UPDATE no action;