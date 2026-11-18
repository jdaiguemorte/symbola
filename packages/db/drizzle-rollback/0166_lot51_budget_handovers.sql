-- Annulation de 0166 (lot 51) : les remises du jour J disparaissent du budget. Refusée tant qu'une
-- échéance est marquée « à remettre le jour J » ou qu'une remise a été pointée : son moyen, la
-- personne qui remet et la preuve de la remise se perdraient (retirez la marque d'abord). Le payé de
-- l'échéance (paid_on) n'est pas touché.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "budget"."vendor_payments" WHERE "handover_on_day" OR "handed_over_at" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des échéances sont à remettre le jour J ou déjà remises (budget.vendor_payments.handover_on_day).';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP CONSTRAINT IF EXISTS "vendor_payments_handover_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "budget"."vendor_payments_handover_action_idx";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN IF EXISTS "handover_receipt_photo_id";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN IF EXISTS "handover_action_id";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN IF EXISTS "handed_over_by";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN IF EXISTS "handed_over_at";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN IF EXISTS "handover_by";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN IF EXISTS "handover_method";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN IF EXISTS "handover_on_day";
