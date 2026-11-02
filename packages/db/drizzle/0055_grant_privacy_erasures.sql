-- Lot 6 (RGPD-03, ADR 0023) — exécutions des demandes d'oubli : données
-- métier, RLS forcée comme hub.privacy_requests. Jamais supprimées par l'app
-- (preuve du traitement).
ALTER TABLE "hub"."privacy_erasures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."privacy_erasures" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."privacy_erasures"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."privacy_erasures" TO symbola_app;
