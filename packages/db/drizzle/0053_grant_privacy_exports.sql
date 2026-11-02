-- Lot 6 (RGPD-02, ADR 0023) — exports RGPD d'une organisation : données
-- métier, RLS forcée comme hub.privacy_requests. Jamais supprimés par l'app :
-- les fichiers sont effacés à l'expiration, la ligne reste comme trace.
ALTER TABLE "hub"."privacy_exports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."privacy_exports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."privacy_exports"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."privacy_exports" TO symbola_app;
