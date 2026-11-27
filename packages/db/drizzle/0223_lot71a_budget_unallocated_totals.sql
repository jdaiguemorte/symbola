-- Lot 71a (BUD-01, HUB-14, C-56 ; spécification du lot 71, § 4.3 ; ADR 0119) : le total engagé et réglé
-- d'un mariage repris, quand l'ancien outil ne donne pas le détail par prestataire. Une ligne par mariage
-- au plus ; le reste à répartir se calcule (total moins la somme des lignes). Montants en centimes, euros.
-- event_id et source_import_id : identifiants opaques, sans clé étrangère entre schémas. RLS forcée.
-- Compatible avec l'image précédente : une table nouvelle (ARC-14).
CREATE TABLE "budget"."unallocated_totals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"committed_cents" integer NOT NULL,
	"paid_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"source_import_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "unallocated_totals_amounts_check" CHECK ("budget"."unallocated_totals"."committed_cents" >= 0 and "budget"."unallocated_totals"."paid_cents" >= 0),
	CONSTRAINT "unallocated_totals_currency_check" CHECK ("budget"."unallocated_totals"."currency" = 'EUR')
);
--> statement-breakpoint
CREATE INDEX "unallocated_totals_organization_idx" ON "budget"."unallocated_totals" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unallocated_totals_event_idx" ON "budget"."unallocated_totals" USING btree ("organization_id","event_id");

--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). La ligne disparaît
-- quand la planner la ferme, quand tout est réparti, ou avec le budget de l'évènement.
ALTER TABLE "budget"."unallocated_totals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."unallocated_totals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."unallocated_totals"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."unallocated_totals" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "unallocated_totals_stamp" BEFORE INSERT OR UPDATE ON "budget"."unallocated_totals"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "unallocated_totals_journal_deletion" BEFORE DELETE ON "budget"."unallocated_totals"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
