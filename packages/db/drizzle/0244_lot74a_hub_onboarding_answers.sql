-- Lot 74a (HUB-09 ; spécification du lot 74, § 4.1 ; B3, B5, D6, L74-D4 tranchée le 27/11/2026) : deux réponses
-- de l'assistant de démarrage. « Avez-vous déjà des mariages en cours ? » (`yes`, `no` ; nul : pas encore
-- répondu, parcours non choisi) choisit la fin de l'assistant et le parcours des tutoriels ; « Je ne sais pas
-- encore » pour la TVA garde la franchise et pose `vat_answer_pending`, relu avant tout envoi de devis. Aucune
-- valeur proposée pour un fait (M13) ; aucune étape de données. Réponses de l'organisation, sans donnée
-- personnelle. Compatible avec l'image précédente (ARC-14) : colonnes ajoutées, nulles ou fausses.
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "has_ongoing_events" text;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "vat_answer_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_has_ongoing_events_check" CHECK ("hub"."organization_profiles"."has_ongoing_events" is null or "hub"."organization_profiles"."has_ongoing_events" in ('yes', 'no'));