-- Annulation de 0154 (lot 41) : la copie de la réforme des pièces émises (Factur-X, bon de commande,
-- livraison, catégorie, débits), l'acheteur entreprise et les références des devis, la nature des
-- lignes et les conditions des professionnels sont perdus. Refusée tant qu'une pièce non fictive
-- porte sa copie de la réforme : ses originaux Factur-X resteraient sans leur description.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "quotes"."invoices" WHERE reform_snapshot IS NOT NULL AND NOT is_demo)
     OR EXISTS (SELECT 1 FROM "quotes"."credit_notes" WHERE reform_snapshot IS NOT NULL AND NOT is_demo) THEN
    RAISE EXCEPTION 'Annulation refusée : des factures ou avoirs Factur-X sont émis (pièces immuables, ADR 0061).';
  END IF;
END $$;
--> statement-breakpoint
REVOKE UPDATE ("reform_snapshot") ON "quotes"."invoices", "quotes"."credit_notes" FROM symbola_app;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."forbid_issued_document_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_demo THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE'
    AND current_setting('app.retention_anonymization', true) = 'on'
    AND (to_jsonb(NEW) - 'buyer_snapshot') = (to_jsonb(OLD) - 'buyer_snapshot') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'document émis immuable (%) : correction par avoir', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS "quotes"."reform_without_delivery"(jsonb);
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" DROP CONSTRAINT IF EXISTS "quotes_buyer_reference_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" DROP CONSTRAINT IF EXISTS "quotes_client_order_reference_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_lines" DROP CONSTRAINT IF EXISTS "quote_template_lines_nature_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP CONSTRAINT IF EXISTS "quote_settings_professional_discount_terms_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP CONSTRAINT IF EXISTS "quote_settings_professional_payment_term_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP CONSTRAINT IF EXISTS "quote_lines_nature_check";
--> statement-breakpoint
ALTER TABLE "quotes"."original_documents" DROP CONSTRAINT IF EXISTS "original_documents_format_check";
--> statement-breakpoint
ALTER TABLE "quotes"."catalog_items" DROP CONSTRAINT IF EXISTS "catalog_items_nature_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" DROP COLUMN IF EXISTS "delivery_address";
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" DROP COLUMN IF EXISTS "buyer_reference";
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" DROP COLUMN IF EXISTS "client_order_reference";
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" DROP COLUMN IF EXISTS "buyer_contact_id";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_lines" DROP COLUMN IF EXISTS "nature";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN IF EXISTS "professional_discount_terms";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN IF EXISTS "professional_payment_term_end_of_month";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN IF EXISTS "professional_payment_term_days";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN IF EXISTS "nature";
--> statement-breakpoint
ALTER TABLE "quotes"."original_documents" DROP COLUMN IF EXISTS "format";
--> statement-breakpoint
ALTER TABLE "quotes"."invoices" DROP COLUMN IF EXISTS "reform_snapshot";
--> statement-breakpoint
ALTER TABLE "quotes"."credit_notes" DROP COLUMN IF EXISTS "reform_snapshot";
--> statement-breakpoint
ALTER TABLE "quotes"."catalog_items" DROP COLUMN IF EXISTS "nature";
