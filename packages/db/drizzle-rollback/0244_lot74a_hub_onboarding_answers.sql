-- Annulation de 0244 (lot 74a) : la réponse « mariages en cours » et le drapeau « TVA à dire » disparaissent.
-- Réponses de l'organisation sans autre trace : l'image précédente ne les lit pas ; la franchise posée par
-- « Je ne sais pas encore » reste le régime de l'organisation, comme avant le lot.
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT IF EXISTS "organization_profiles_has_ongoing_events_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "vat_answer_pending";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "has_ongoing_events";
