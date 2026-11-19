-- Annulation de 0177 (lot 48b) : honoraires, commissions, mode et nature touristique des lignes,
-- nature des modèles de contrat et facture de commission disparaissent. Refusée tant qu'une facture de
-- commission est émise (une pièce émise ne se supprime jamais), qu'une commission ou des honoraires
-- existent, qu'une ligne est en mode intermédiaire ou porte une nature touristique, ou qu'un modèle
-- n'est pas un contrat (leur sens serait perdu).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "quotes"."invoices" WHERE "commission_id" IS NOT NULL OR "quote_id" IS NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des factures de commission sont émises (quotes.invoices.commission_id).';
  END IF;
  IF EXISTS (SELECT 1 FROM "quotes"."vendor_commissions") OR EXISTS (SELECT 1 FROM "quotes"."planner_fees") THEN
    RAISE EXCEPTION 'Annulation refusée : des commissions ou des honoraires sont tracés (quotes.vendor_commissions, quotes.planner_fees).';
  END IF;
  IF EXISTS (SELECT 1 FROM "quotes"."quote_lines" WHERE "supply_mode" <> 'resale' OR "tourism_kind" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de devis sont en mode intermédiaire ou ont une nature touristique (quotes.quote_lines).';
  END IF;
  IF EXISTS (SELECT 1 FROM "quotes"."contract_templates" WHERE "kind" <> 'contract') THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles de mandat, de conditions générales ou de forfait touristique existent (quotes.contract_templates).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "quotes"."invoices" DROP CONSTRAINT IF EXISTS "invoices_subject_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "quotes"."invoices_commission_idx";
--> statement-breakpoint
ALTER TABLE "quotes"."invoices" DROP COLUMN IF EXISTS "commission_id";
--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ALTER COLUMN "quote_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ALTER COLUMN "version_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes"."contract_templates" DROP CONSTRAINT IF EXISTS "contract_templates_kind_check";
--> statement-breakpoint
ALTER TABLE "quotes"."contract_templates" DROP COLUMN IF EXISTS "kind";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP CONSTRAINT IF EXISTS "quote_lines_tourism_kind_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP CONSTRAINT IF EXISTS "quote_lines_supply_mode_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN IF EXISTS "tourism_kind", DROP COLUMN IF EXISTS "supply_mode";
--> statement-breakpoint
DROP TABLE IF EXISTS "quotes"."vendor_commissions";
--> statement-breakpoint
DROP TABLE IF EXISTS "quotes"."planner_fees";
