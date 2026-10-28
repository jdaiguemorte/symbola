-- Lot 5 (IMP-01, ADR 0022) — un import en cours garde des données métier
-- d'une organisation (lignes du fichier) : Row-Level Security forcée, comme
-- les tables des modules (CLAUDE.md §2.4), alors que les autres tables du
-- hub sont des tables d'identité sans RLS.
ALTER TABLE "hub"."imports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."imports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."imports"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."imports" TO symbola_app;
--> statement-breakpoint
-- La ligne unique des réglages de la plateforme existe toujours, avec les
-- valeurs de départ de l'import portées par ses colonnes.
INSERT INTO "hub"."platform_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
