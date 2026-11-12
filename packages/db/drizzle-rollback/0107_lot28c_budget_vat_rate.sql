-- Annulation de 0107 (lot 28c, BUD-09) : le taux de TVA des lignes est perdu ;
-- les montants TTC restent.
ALTER TABLE "budget"."budget_lines" DROP CONSTRAINT "budget_lines_vat_rate_check";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" DROP COLUMN "vat_rate_basis_points";
