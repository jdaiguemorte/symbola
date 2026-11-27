-- Annulation de 0221 (lot 71a) : le contrat déclaré à la reprise disparaît. Refusée tant qu'un
-- prestataire en porte un : l'image précédente en ferait aussitôt une relance « à faire signer ».
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_vendor_candidates" WHERE takeover_contract IS NOT NULL) THEN
    RAISE EXCEPTION 'annulation refusée : des prestataires retenus par une reprise portent un contrat déclaré' USING ERRCODE = 'P0001';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP CONSTRAINT IF EXISTS "event_vendor_candidates_takeover_contract_check";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "takeover_contract";
