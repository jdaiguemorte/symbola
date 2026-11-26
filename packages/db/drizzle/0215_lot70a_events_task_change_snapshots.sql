-- Lot 70a (UX-07 ; C-09, A18, « Oui, la table », 26/11/2026) : valeurs d'avant un « Changer la date » ou un
-- « Confier à » (jusqu'à 500 tâches en lot), pour « Annuler » pendant dix secondes. Table technique : des
-- identifiants et des dates, aucune donnée personnelle ; purgée par la tâche horaire après dix minutes.
-- Schéma events seulement ; table nouvelle, compatible avec l'image précédente.
CREATE TABLE "events"."task_change_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "task_change_snapshots_organization_idx" ON "events"."task_change_snapshots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "task_change_snapshots_expires_idx" ON "events"."task_change_snapshots" USING btree ("expires_at");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif. Pas d'horodatage d'auteur (core.stamp_row) : l'auteur
-- est user_id, la ligne ne vit que dix minutes (packages/db/src/row-stamps.ts, TECHNICAL_TABLES).
ALTER TABLE "events"."task_change_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."task_change_snapshots" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."task_change_snapshots"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."task_change_snapshots" TO symbola_app;
