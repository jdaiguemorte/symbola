-- Annulation de 0103 (lot 28a, PRE-02) : retour au statut du poste (À trouver,
-- Devis demandé, Devis reçu, Réservé, Non requis) et à la réponse du prestataire
-- consulté (Contacté, Devis reçu, Décliné). Pressenti redevient Contacté ; Retenu,
-- Contrat signé et Soldé redeviennent Devis reçu, leur poste « Réservé ». Écarté
-- redevient Décliné, y compris pour un prestataire seulement « non retenu » avant
-- 0103 (la nuance est perdue). Les prestataires créés par la reprise depuis un
-- poste réservé restent consultés.
CREATE TYPE "events"."vendor_slot_status" AS ENUM('to_find', 'quote_requested', 'quote_received', 'booked', 'not_required');
--> statement-breakpoint
CREATE TYPE "events"."vendor_candidate_response" AS ENUM('contacted', 'quote_received', 'declined');
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "status" "events"."vendor_slot_status" DEFAULT 'to_find' NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "response" "events"."vendor_candidate_response" DEFAULT 'contacted' NOT NULL;
--> statement-breakpoint
UPDATE "events"."event_vendor_candidates"
  SET "response" = (CASE "status"::text
    WHEN 'shortlisted' THEN 'contacted'
    WHEN 'contacted' THEN 'contacted'
    WHEN 'dismissed' THEN 'declined'
    ELSE 'quote_received' END)::"events"."vendor_candidate_response";
--> statement-breakpoint
UPDATE "events"."event_vendor_slots" s
  SET "status" = (CASE
    WHEN s."not_required" THEN 'not_required'
    WHEN EXISTS (SELECT 1 FROM "events"."event_vendor_candidates" c WHERE c."vendor_slot_id" = s."id" AND c."status" IN ('retained', 'contract_signed', 'paid_off')) THEN 'booked'
    WHEN EXISTS (SELECT 1 FROM "events"."event_vendor_candidates" c WHERE c."vendor_slot_id" = s."id" AND c."status" = 'quote_received') THEN 'quote_received'
    WHEN EXISTS (SELECT 1 FROM "events"."event_vendor_candidates" c WHERE c."vendor_slot_id" = s."id" AND c."status" IN ('shortlisted', 'contacted')) THEN 'quote_requested'
    ELSE 'to_find' END)::"events"."vendor_slot_status";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" DROP COLUMN "not_required";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN "status";
--> statement-breakpoint
DROP TYPE "events"."vendor_candidate_status";
