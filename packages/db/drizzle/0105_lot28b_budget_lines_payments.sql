-- Lot 28b (BUD-01 et décision Q33, BUD-03, BUD-04, ADR 0054) : plusieurs lignes
-- par catégorie (le poste de l'événement), chacune avec son libellé, son
-- prestataire rattaché et son ordre ; nature des documents joints ; échéances
-- des paiements aux prestataires.
ALTER TABLE "budget"."budget_lines" DROP CONSTRAINT "budget_lines_event_vendor_slot_id_unique";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ADD COLUMN "label" text;
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ADD COLUMN "vendor_candidate_id" uuid;
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Reprise (lecture seule du schéma events, avant que 0106 ne retire le
-- prestataire choisi du poste) : chaque ligne devient la première de sa
-- catégorie, au libellé du poste, liée au prestataire retenu du poste.
UPDATE "budget"."budget_lines" bl
  SET "label" = s."label", "vendor_candidate_id" = s."selected_candidate_id"
  FROM "events"."event_vendor_slots" s
  WHERE s."id" = bl."event_vendor_slot_id";
--> statement-breakpoint
-- Ligne dont le poste a disparu : libellé vide (l'écran affiche celui de la catégorie).
UPDATE "budget"."budget_lines" SET "label" = '' WHERE "label" IS NULL;
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ALTER COLUMN "label" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX "budget_lines_event_vendor_slot_idx" ON "budget"."budget_lines" USING btree ("event_vendor_slot_id");
--> statement-breakpoint
CREATE TYPE "budget"."budget_document_kind" AS ENUM('quote', 'contract', 'invoice');
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_attachments" ADD COLUMN "kind" "budget"."budget_document_kind" DEFAULT 'quote' NOT NULL;
--> statement-breakpoint
CREATE TABLE "budget"."vendor_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"label" text NOT NULL,
	"fixed_amount_cents" integer,
	"percentage_basis_points" integer,
	"due_on" date NOT NULL,
	"paid_on" date,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_payments_amount_check" CHECK (("budget"."vendor_payments"."fixed_amount_cents" is not null and "budget"."vendor_payments"."fixed_amount_cents" > 0 and "budget"."vendor_payments"."percentage_basis_points" is null) or ("budget"."vendor_payments"."fixed_amount_cents" is null and "budget"."vendor_payments"."percentage_basis_points" between 1 and 10000))
);
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD CONSTRAINT "vendor_payments_line_id_budget_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "budget"."budget_lines"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "vendor_payments_organization_idx" ON "budget"."vendor_payments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "vendor_payments_line_idx" ON "budget"."vendor_payments" USING btree ("line_id");
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."vendor_payments"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."vendor_payments" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "vendor_payments_stamp" BEFORE INSERT OR UPDATE ON "budget"."vendor_payments"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_payments_journal_deletion" BEFORE DELETE ON "budget"."vendor_payments"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
