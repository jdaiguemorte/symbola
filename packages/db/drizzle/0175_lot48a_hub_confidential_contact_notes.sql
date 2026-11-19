-- Lot 48a (DAT-08 ; D5, ADR 0093) : notes de contact marquées confidentielles, chiffrées au niveau du
-- champ (body_sealed) ; body devient facultatif (vide pour une note confidentielle). Aucune note
-- confidentielle n'existe avant ce lot : l'ancienne version du code lit toutes les notes présentes
-- (ARC-14).
ALTER TABLE "hub"."contact_notes" DROP CONSTRAINT "contact_notes_body_check";--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" ALTER COLUMN "body" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" ADD COLUMN "body_sealed" text;--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" ADD COLUMN "is_confidential" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" ADD CONSTRAINT "contact_notes_body_check" CHECK ((not "hub"."contact_notes"."is_confidential" and "hub"."contact_notes"."body_sealed" is null and "hub"."contact_notes"."body" is not null and char_length("hub"."contact_notes"."body") between 1 and 2000) or ("hub"."contact_notes"."is_confidential" and "hub"."contact_notes"."body" is null and "hub"."contact_notes"."body_sealed" like 'f1:%' and "hub"."contact_notes"."author_user_id" is not null));
