-- Row-Level Security et droits du rôle applicatif sur les tables EVT-05
-- (CLAUDE.md §2.4), même patron que 0023_grant_retroplanning.sql.
ALTER TABLE "events"."program_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."program_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."program_items"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."program_items" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "events"."program_item_participants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."program_item_participants"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."program_item_participants" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "events"."program_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."program_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."program_templates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."program_templates" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "events"."program_template_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."program_template_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."program_template_items"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."program_template_items" TO symbola_app;
