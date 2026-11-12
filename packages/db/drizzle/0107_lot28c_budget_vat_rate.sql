-- Lot 28c (BUD-09, décision D5, ADR 0054) : taux de TVA par ligne de budget, en
-- points de base (2000 = 20 %). Vide, la ligne prend le taux de départ des
-- modèles (ADR 0007) : aucune reprise de données, les lignes existantes restent
-- vides. Les montants restent saisis TTC ; le HT se calcule par taux (ADR 0059).
ALTER TABLE "budget"."budget_lines" ADD COLUMN "vat_rate_basis_points" integer;
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ADD CONSTRAINT "budget_lines_vat_rate_check" CHECK ("budget"."budget_lines"."vat_rate_basis_points" between 0 and 10000);
