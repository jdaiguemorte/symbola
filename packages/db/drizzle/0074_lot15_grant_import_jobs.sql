-- Lot 15 (IMP-10, GEO-01) — traitements de fond des imports : données d'une
-- organisation (noms de fichiers, identifiants de fiches), RLS forcée comme
-- hub.imports.
ALTER TABLE "hub"."import_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."import_jobs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."import_jobs"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."import_jobs" TO symbola_app;
