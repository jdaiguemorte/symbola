-- Lot 28a (PRE-02, décisions Q9 et D3, ADR 0054) : statut de chaque prestataire
-- rattaché à un événement, aligné sur le cahier des charges (Pressenti, Consulté,
-- Devis reçu, Retenu, Contrat signé, Soldé, plus Écarté). Le poste n'a plus de
-- statut à lui : il affiche le plus avancé de ses prestataires ; « Non requis »
-- devient une case du poste.
CREATE TYPE "events"."vendor_candidate_status" AS ENUM('shortlisted', 'contacted', 'quote_received', 'retained', 'contract_signed', 'paid_off', 'dismissed');
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "status" "events"."vendor_candidate_status" DEFAULT 'shortlisted' NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "not_required" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Reprise des réponses : Contacté → Consulté, Devis reçu → Devis reçu, Décliné → Écarté.
UPDATE "events"."event_vendor_candidates"
  SET "status" = (CASE "response"::text WHEN 'contacted' THEN 'contacted' WHEN 'quote_received' THEN 'quote_received' ELSE 'dismissed' END)::"events"."vendor_candidate_status";
--> statement-breakpoint
-- Le prestataire choisi d'un poste « Réservé » devient Retenu.
UPDATE "events"."event_vendor_candidates" c
  SET "status" = 'retained'
  FROM "events"."event_vendor_slots" s
  WHERE s."selected_candidate_id" = c."id" AND s."status" = 'booked';
--> statement-breakpoint
-- Un poste « Réservé » sans prestataire consulté : son prestataire saisi à la main
-- devient un prestataire rattaché, Retenu, au montant du poste.
INSERT INTO "events"."event_vendor_candidates" ("organization_id", "event_id", "vendor_slot_id", "vendor_name", "status", "quote_amount_cents", "currency", "position")
  SELECT s."organization_id", s."event_id", s."id", s."vendor_name", 'retained', s."amount_cents", s."currency", 0
  FROM "events"."event_vendor_slots" s
  WHERE s."status" = 'booked' AND s."selected_candidate_id" IS NULL AND s."vendor_name" IS NOT NULL;
--> statement-breakpoint
UPDATE "events"."event_vendor_slots" s
  SET "selected_candidate_id" = c."id"
  FROM "events"."event_vendor_candidates" c
  WHERE c."vendor_slot_id" = s."id" AND c."status" = 'retained' AND s."selected_candidate_id" IS NULL;
--> statement-breakpoint
-- Les autres prestataires d'un poste dont un prestataire est Retenu étaient
-- « non retenus » : ils deviennent Écartés (un autre a été retenu).
UPDATE "events"."event_vendor_candidates" c
  SET "status" = 'dismissed'
  WHERE c."status" <> 'retained'
    AND EXISTS (SELECT 1 FROM "events"."event_vendor_candidates" r WHERE r."vendor_slot_id" = c."vendor_slot_id" AND r."status" = 'retained');
--> statement-breakpoint
UPDATE "events"."event_vendor_slots" SET "not_required" = true WHERE "status" = 'not_required';
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN "response";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" DROP COLUMN "status";
--> statement-breakpoint
DROP TYPE "events"."vendor_candidate_response";
--> statement-breakpoint
DROP TYPE "events"."vendor_slot_status";
