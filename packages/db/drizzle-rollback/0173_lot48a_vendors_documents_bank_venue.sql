-- Annulation de 0173 (lot 48a) : pièces, natures de pièces, journal des changements d'IBAN, IBAN, BIC
-- et note confidentielle chiffrés, sens des champs de lieu et délai d'alerte disparaissent. Refusée
-- tant qu'une pièce est rangée sur une fiche (son fichier serait perdu), qu'un IBAN chiffré ou une note
-- confidentielle existe (ils seraient perdus) ou qu'un changement d'IBAN est tracé (le journal serait
-- perdu). Les natures de pièces et le sens des champs, eux, se perdent : ce sont des réglages.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "vendors"."vendor_documents") THEN
    RAISE EXCEPTION 'Annulation refusée : des pièces sont rangées sur des fiches de prestataires (vendors.vendor_documents).';
  END IF;
  IF EXISTS (SELECT 1 FROM "vendors"."vendor_bank_changes") THEN
    RAISE EXCEPTION 'Annulation refusée : des changements d''IBAN sont tracés (vendors.vendor_bank_changes).';
  END IF;
  IF EXISTS (SELECT 1 FROM "vendors"."vendors" WHERE "iban_sealed" IS NOT NULL OR "internal_note_sealed" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des IBAN ou des notes confidentielles sont chiffrés sur des fiches (vendors.vendors).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" DROP CONSTRAINT IF EXISTS "vendors_sealed_fields_check";
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" DROP COLUMN IF EXISTS "iban_masked", DROP COLUMN IF EXISTS "bic_sealed", DROP COLUMN IF EXISTS "iban_sealed", DROP COLUMN IF EXISTS "internal_note_confidential_by", DROP COLUMN IF EXISTS "internal_note_sealed";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" DROP CONSTRAINT IF EXISTS "vendor_type_fields_rule_key_check";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" DROP COLUMN IF EXISTS "rule_key";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" DROP CONSTRAINT IF EXISTS "vendor_settings_document_alert_days_check";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" DROP COLUMN IF EXISTS "venue_fields_seeded_at", DROP COLUMN IF EXISTS "document_kinds_seeded_at", DROP COLUMN IF EXISTS "document_alert_days";
--> statement-breakpoint
DROP TABLE IF EXISTS "vendors"."vendor_bank_changes";
--> statement-breakpoint
DROP TABLE IF EXISTS "vendors"."vendor_documents";
--> statement-breakpoint
DROP TABLE IF EXISTS "vendors"."vendor_document_kinds";
