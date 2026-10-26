-- SOC-05 — Schémas des modules à venir (ADR 0012 : un schéma logique par
-- module, une seule base). Vides pour l'instant, remplis par les lots
-- suivants (events, budget, quotes) ; hub reste dans le schéma public du
-- socle (identité, organisations — arrive avec SOC-04).
CREATE SCHEMA IF NOT EXISTS "events";
CREATE SCHEMA IF NOT EXISTS "budget";
CREATE SCHEMA IF NOT EXISTS "quotes";
CREATE SCHEMA IF NOT EXISTS "hub";
--> statement-breakpoint

-- Le rôle applicatif (symbola_app) doit déjà exister : il est créé par
-- packages/db/scripts/bootstrap-roles.ts (jamais par une migration
-- versionnée, pour ne jamais committer de mot de passe). Il n'est
-- propriétaire d'aucune table et n'a pas BYPASSRLS.
GRANT USAGE ON SCHEMA "hello", "events", "budget", "quotes", "hub" TO symbola_app;
--> statement-breakpoint

-- Row-Level Security sur hello.greetings (ADR 0003/0012). FORCE RLS pour
-- que même le propriétaire de la table (le rôle admin) soit filtré ; seule
-- une session sans BYPASSRLS qui fixe app.organization_id voit des lignes.
ALTER TABLE "hello"."greetings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hello"."greetings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY organization_isolation ON "hello"."greetings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "hello"."greetings" TO symbola_app;
