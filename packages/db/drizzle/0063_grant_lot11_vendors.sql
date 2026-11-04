-- Lot 11 (ADR 0031) : Row-Level Security et droits du rôle applicatif sur le
-- carnet de prestataires (schéma vendors) et les prestataires consultés
-- (schéma events). Même patron que les migrations 0019 et 0021.
GRANT USAGE ON SCHEMA "vendors" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "events"."event_vendor_candidates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_vendor_candidates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_vendor_candidates" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "events"."event_vendor_candidate_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidate_notes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_vendor_candidate_notes"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_vendor_candidate_notes" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "vendors"."vendor_types" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_types"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_types" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "vendors"."vendor_type_fields" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_type_fields"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_type_fields" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "vendors"."vendor_tags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_tags"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_tags" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "vendors"."vendors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendors"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendors" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "vendors"."vendor_files" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_files" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_files"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_files" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "vendors"."vendor_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_settings" TO symbola_app;
