-- Annulation de 0105 (lot 28b, BUD-01, BUD-03, BUD-04) : une ligne par poste,
-- sans libellé ni prestataire ; plus de nature des documents (tous redeviennent
-- des devis) ni d'échéances (elles sont perdues ; le payé des lignes reste).
-- Refusée tant qu'un poste a plus d'une ligne.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "budget"."budget_lines" GROUP BY "event_vendor_slot_id" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Annulation refusée : des postes ont plusieurs lignes de budget.';
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE "budget"."vendor_payments";
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_attachments" DROP COLUMN "kind";
--> statement-breakpoint
DROP TYPE "budget"."budget_document_kind";
--> statement-breakpoint
DROP INDEX "budget"."budget_lines_event_vendor_slot_idx";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" DROP COLUMN "position";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" DROP COLUMN "vendor_candidate_id";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" DROP COLUMN "label";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ADD CONSTRAINT "budget_lines_event_vendor_slot_id_unique" UNIQUE("event_vendor_slot_id");
