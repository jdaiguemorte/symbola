-- Row-Level Security sur les tables du module quotes (DEV-01, CLAUDE.md §2.4,
-- même patron que 0030_grant_budget_tables.sql).
ALTER TABLE "quotes"."quote_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."quote_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."quote_settings" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "quotes"."number_series" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."number_series" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."number_series"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."number_series" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "quotes"."catalog_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."catalog_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."catalog_items"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."catalog_items" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "quotes"."quotes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."quotes"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."quotes" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "quotes"."quote_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."quote_versions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."quote_versions" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "quotes"."quote_lines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."quote_lines"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."quote_lines" TO symbola_app;
