-- Lot 48a (DAT-08 ; D5, ADR 0093) : notes d'évènement marquées confidentielles, chiffrées au niveau
-- du champ (notes_sealed) avec leur auteur. Ajout seul (colonnes facultatives, contrainte) :
-- compatible avec la version précédente du code (ARC-14).
ALTER TABLE "events"."events" ADD COLUMN "notes_sealed" text;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "notes_confidential_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."events" ADD CONSTRAINT "events_notes_sealed_check" CHECK ("events"."events"."notes_sealed" is null or ("events"."events"."notes" is null and "events"."events"."notes_sealed" like 'f1:%' and "events"."events"."notes_confidential_by" is not null));
