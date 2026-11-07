ALTER TABLE "vendors"."vendors" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "social_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "siret" text;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "imported_fields" jsonb;