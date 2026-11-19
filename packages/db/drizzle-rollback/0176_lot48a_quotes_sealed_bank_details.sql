-- Annulation de 0176 (lot 48a) : l'étape de données inverse (packages/db/scripts/data-steps.ts) a
-- déjà remis l'IBAN et le BIC de la planner en clair, dans la même transaction ; les colonnes
-- chiffrées disparaissent. Refusée si une valeur chiffrée reste (elle serait perdue).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "quotes"."quote_settings" WHERE "iban_sealed" IS NOT NULL OR "bic_sealed" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : l''IBAN ou le BIC d''une organisation est encore chiffré (quotes.quote_settings) ; DATA_ENCRYPTION_KEY est-elle fournie ?';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP CONSTRAINT IF EXISTS "quote_settings_sealed_bank_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN IF EXISTS "bic_sealed", DROP COLUMN IF EXISTS "iban_sealed";
