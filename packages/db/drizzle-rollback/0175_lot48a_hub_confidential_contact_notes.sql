-- Annulation de 0175 (lot 48a) : les notes de contact confidentielles disparaissent et le texte d'une
-- note redevient obligatoire. Refusée tant qu'une note confidentielle existe : elle serait perdue.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."contact_notes" WHERE "is_confidential" OR "body_sealed" IS NOT NULL OR "body" IS NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des notes de contact sont confidentielles (hub.contact_notes.body_sealed).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" DROP CONSTRAINT IF EXISTS "contact_notes_body_check";
--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" DROP COLUMN IF EXISTS "is_confidential", DROP COLUMN IF EXISTS "body_sealed";
--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" ALTER COLUMN "body" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "hub"."contact_notes" ADD CONSTRAINT "contact_notes_body_check" CHECK (char_length("hub"."contact_notes"."body") between 1 and 2000);
