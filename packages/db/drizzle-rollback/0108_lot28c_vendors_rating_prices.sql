-- Annulation de 0108 (lot 28c, PRE-01) : l'évaluation et les tarifs indicatifs
-- des fiches du carnet sont perdus.
ALTER TABLE "vendors"."vendors" DROP CONSTRAINT "vendors_rating_check";
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" DROP COLUMN "indicative_prices";
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" DROP COLUMN "rating";
