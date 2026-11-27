-- Lot 71a (HUB-14, C-66, R7, R14 ; spécification du lot 71, § 4.1 ; décisions I4, I8 et I9 de Julien
-- du 27/11/2026 ; ADR 0119) : le journal commun des imports.
-- - Sortes « event_vendors » et « program » : les PDF des prestataires retenus et du programme entrent
--   dans le journal (bilan, retrait d'ensemble ; écrans du paquet 71e).
-- - hub.imports.takeover_id : la reprise de l'import (nul hors reprise et pour les imports d'avant,
--   I8 : rien n'est reconstruit ; aucune étape de données).
-- - hub.imports.leftovers : ce que le fichier contenait sans être repris (l'annuaire d'un programme),
--   effacé après platform_settings.import_leftovers_retention_days (90 jours, I4, à confirmer par le DPO).
-- - hub.import_items.fields : noms des champs écrits, sans valeur (« D'où viennent ces valeurs ? », I9).
-- Compatible avec l'image précédente : valeurs d'énumération, colonnes facultatives ou avec une valeur
-- par défaut, un index (ARC-14).
ALTER TYPE "hub"."import_entity_type" ADD VALUE 'event_vendors';--> statement-breakpoint
ALTER TYPE "hub"."import_entity_type" ADD VALUE 'program';--> statement-breakpoint
ALTER TABLE "hub"."import_items" ADD COLUMN "fields" text[];--> statement-breakpoint
ALTER TABLE "hub"."imports" ADD COLUMN "takeover_id" uuid;--> statement-breakpoint
ALTER TABLE "hub"."imports" ADD COLUMN "leftovers" jsonb;--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "import_leftovers_retention_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."imports" ADD CONSTRAINT "imports_takeover_id_takeovers_id_fk" FOREIGN KEY ("takeover_id") REFERENCES "hub"."takeovers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "imports_takeover_idx" ON "hub"."imports" USING btree ("takeover_id");
