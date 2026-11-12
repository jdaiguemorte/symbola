-- Annulation de 0106 (lot 28b, PRE-02) : le poste retrouve un nom, un montant et
-- un prestataire choisi, repris de son premier prestataire engagé (Retenu,
-- Contrat signé ou Soldé, dans l'ordre des prestataires). Un second prestataire
-- retenu du même poste reste rattaché, sans être le prestataire choisi. Les
-- prestataires créés par la reprise depuis un nom de poste restent rattachés.
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "vendor_name" text;
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "amount_cents" integer;
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "currency" text DEFAULT 'EUR' NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "selected_candidate_id" uuid;
--> statement-breakpoint
UPDATE "events"."event_vendor_slots" s
  SET "selected_candidate_id" = c."id", "vendor_name" = c."vendor_name", "amount_cents" = c."quote_amount_cents"
  FROM (
    SELECT DISTINCT ON ("vendor_slot_id") "id", "vendor_slot_id", "vendor_name", "quote_amount_cents"
    FROM "events"."event_vendor_candidates"
    WHERE "status" IN ('retained', 'contract_signed', 'paid_off')
    ORDER BY "vendor_slot_id", "position", "created_at"
  ) c
  WHERE c."vendor_slot_id" = s."id";
