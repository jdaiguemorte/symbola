CREATE TABLE "vendors"."vendor_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"icon" text DEFAULT 'other' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"starter_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_families_organization_starter_key_unique" UNIQUE("organization_id","starter_key")
);
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" ADD COLUMN "families_seeded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" ADD COLUMN "family_id" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" ADD COLUMN "starter_key" text;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" ADD CONSTRAINT "vendor_types_family_id_vendor_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "vendors"."vendor_families"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Lot 16 (PRE-14, ADR 0040) : index des types par famille (pastilles du
-- carnet, couleur de la carte).
CREATE INDEX "vendor_types_family_id_idx" ON "vendors"."vendor_types" ("family_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif, même patron que 0063.
ALTER TABLE "vendors"."vendor_families" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_families" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_families"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_families" TO symbola_app;