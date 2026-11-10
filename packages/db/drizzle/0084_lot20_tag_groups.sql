CREATE TABLE "vendors"."vendor_tag_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"exclusive" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" ADD COLUMN "family_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" ADD CONSTRAINT "vendor_tags_group_id_vendor_tag_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "vendors"."vendor_tag_groups"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Lot 20 (décision 5, ADR 0049) : étiquettes rangées par groupe.
CREATE INDEX "vendor_tags_group_id_idx" ON "vendors"."vendor_tags" ("group_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif, même patron que 0077.
ALTER TABLE "vendors"."vendor_tag_groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tag_groups" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_tag_groups"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_tag_groups" TO symbola_app;