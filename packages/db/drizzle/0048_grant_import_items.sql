-- Lot 5 (IMP-05, ADR 0022) — journal des éléments écrits par un import :
-- valeurs précédentes et écrites (données métier), RLS forcée comme
-- hub.imports.
ALTER TABLE "hub"."import_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."import_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."import_items"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."import_items" TO symbola_app;
