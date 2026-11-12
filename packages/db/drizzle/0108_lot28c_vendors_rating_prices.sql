-- Lot 28c (PRE-01, décision D8) : la fiche du carnet gagne une évaluation
-- interne (1 à 5) et des tarifs indicatifs (texte libre). Aucune reprise de
-- données : les fiches existantes restent sans évaluation ni tarifs.
ALTER TABLE "vendors"."vendors" ADD COLUMN "rating" integer;
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "indicative_prices" text;
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD CONSTRAINT "vendors_rating_check" CHECK ("vendors"."vendors"."rating" between 1 and 5);
