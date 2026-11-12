-- Lot 28b (PRE-02, décisions D10 et D14, ADR 0054) : plusieurs prestataires
-- retenus par poste ; le nom, le montant et le prestataire choisi du poste
-- disparaissent, ses prestataires rattachés les portent.
-- Reprise : un nom saisi sur le poste (import, lot 5) sans prestataire
-- rattaché de ce nom devient un prestataire rattaché « Pressenti ».
INSERT INTO "events"."event_vendor_candidates" ("organization_id", "event_id", "vendor_slot_id", "vendor_name", "status", "currency", "position")
  SELECT s."organization_id", s."event_id", s."id", btrim(s."vendor_name"), 'shortlisted', 'EUR',
    COALESCE((SELECT max(c."position") + 1 FROM "events"."event_vendor_candidates" c WHERE c."vendor_slot_id" = s."id"), 0)
  FROM "events"."event_vendor_slots" s
  WHERE s."vendor_name" IS NOT NULL AND btrim(s."vendor_name") <> ''
    AND NOT EXISTS (
      SELECT 1 FROM "events"."event_vendor_candidates" c
      WHERE c."vendor_slot_id" = s."id" AND lower(btrim(c."vendor_name")) = lower(btrim(s."vendor_name"))
    );
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" DROP COLUMN "selected_candidate_id";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" DROP COLUMN "vendor_name";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" DROP COLUMN "amount_cents";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" DROP COLUMN "currency";
