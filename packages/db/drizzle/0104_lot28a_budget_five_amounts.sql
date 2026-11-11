-- Lot 28a (BUD-01, BUD-02, décisions D2 et D4, ADR 0054) : cinq montants par
-- ligne de budget (estimé, devisé, engagé, payé ; le reste à payer se calcule),
-- et seuil d'alerte de l'enveloppe.
-- Reprise (D2) : le prévu devient l'estimé, le réel devient l'engagé (il était
-- rempli au passage du poste à « Réservé »), le devisé reprend le devis du
-- prestataire retenu, le payé part de zéro.
ALTER TABLE "budget"."budget_lines" RENAME COLUMN "planned_amount_cents" TO "estimated_amount_cents";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" RENAME COLUMN "actual_amount_cents" TO "committed_amount_cents";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ADD COLUMN "quoted_amount_cents" integer;
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ADD COLUMN "paid_amount_cents" integer;
--> statement-breakpoint
-- Lecture seule du module Événements (0103 appliquée avant) : le devis du
-- prestataire retenu du poste. Aucune écriture hors du schéma budget.
UPDATE "budget"."budget_lines" bl
  SET "quoted_amount_cents" = c."quote_amount_cents"
  FROM "events"."event_vendor_slots" s
  JOIN "events"."event_vendor_candidates" c ON c."id" = s."selected_candidate_id"
  WHERE bl."event_vendor_slot_id" = s."id" AND c."quote_amount_cents" IS NOT NULL;
--> statement-breakpoint
ALTER TYPE "budget"."budget_line_field" RENAME VALUE 'planned' TO 'estimated';
--> statement-breakpoint
ALTER TYPE "budget"."budget_line_field" RENAME VALUE 'actual' TO 'committed';
--> statement-breakpoint
ALTER TYPE "budget"."budget_line_field" ADD VALUE 'quoted' BEFORE 'committed';
--> statement-breakpoint
ALTER TYPE "budget"."budget_line_field" ADD VALUE 'paid';
--> statement-breakpoint
CREATE TABLE "budget"."alert_thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid,
	"percent" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "alert_thresholds_organization_event_unique" UNIQUE NULLS NOT DISTINCT("organization_id","event_id"),
	CONSTRAINT "alert_thresholds_percent_check" CHECK ("budget"."alert_thresholds"."percent" between 1 and 500)
);
--> statement-breakpoint
CREATE INDEX "alert_thresholds_organization_idx" ON "budget"."alert_thresholds" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "budget"."alert_thresholds" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."alert_thresholds" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."alert_thresholds"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."alert_thresholds" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "alert_thresholds_stamp" BEFORE INSERT OR UPDATE ON "budget"."alert_thresholds"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "alert_thresholds_journal_deletion" BEFORE DELETE ON "budget"."alert_thresholds"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
