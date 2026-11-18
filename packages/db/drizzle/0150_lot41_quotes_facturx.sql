-- Lot 41 (FAC-10, JUR-02, JUR-12, JUR-13 ; D1, D6, D8, D9, D11 ; ADR 0078) : Factur-X et mentions de la
-- réforme dans le schéma quotes. Ajouts seulement (colonnes facultatives ou avec valeur par défaut,
-- contraintes) : l'ancien code continue de tourner pendant la migration.
ALTER TABLE "quotes"."catalog_items" ADD COLUMN "nature" text DEFAULT 'service' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."credit_notes" ADD COLUMN "reform_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ADD COLUMN "reform_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "quotes"."original_documents" ADD COLUMN "format" text DEFAULT 'pdf' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "nature" text DEFAULT 'service' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "professional_payment_term_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "professional_payment_term_end_of_month" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "professional_discount_terms" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_lines" ADD COLUMN "nature" text DEFAULT 'service' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD COLUMN "buyer_contact_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD COLUMN "client_order_reference" text;--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD COLUMN "buyer_reference" text;--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD COLUMN "delivery_address" jsonb;--> statement-breakpoint
ALTER TABLE "quotes"."catalog_items" ADD CONSTRAINT "catalog_items_nature_check" CHECK ("quotes"."catalog_items"."nature" in ('service', 'goods'));--> statement-breakpoint
ALTER TABLE "quotes"."original_documents" ADD CONSTRAINT "original_documents_format_check" CHECK ("quotes"."original_documents"."format" in ('pdf', 'facturx'));--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD CONSTRAINT "quote_lines_nature_check" CHECK ("quotes"."quote_lines"."nature" in ('service', 'goods'));--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD CONSTRAINT "quote_settings_professional_payment_term_check" CHECK ("quotes"."quote_settings"."professional_payment_term_days" between 0 and 120);--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD CONSTRAINT "quote_settings_professional_discount_terms_check" CHECK ("quotes"."quote_settings"."professional_discount_terms" is null or char_length("quotes"."quote_settings"."professional_discount_terms") <= 500);--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_lines" ADD CONSTRAINT "quote_template_lines_nature_check" CHECK ("quotes"."quote_template_lines"."nature" in ('service', 'goods'));--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD CONSTRAINT "quotes_client_order_reference_check" CHECK ("quotes"."quotes"."client_order_reference" is null or char_length("quotes"."quotes"."client_order_reference") between 1 and 60);--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD CONSTRAINT "quotes_buyer_reference_check" CHECK ("quotes"."quotes"."buyer_reference" is null or char_length("quotes"."quotes"."buyer_reference") between 1 and 60);
--> statement-breakpoint
-- La copie de la réforme d'une pièce émise reste immuable (déclencheur invoices_immutable,
-- credit_notes_immutable) ; à la fin de la conservation comptable (RGPD-05, ADR 0024), seule
-- l'adresse de livraison qu'elle porte s'efface, dans la même transaction déclarée que l'acheteur.
CREATE OR REPLACE FUNCTION "quotes"."reform_without_delivery"(reform jsonb) RETURNS jsonb
  LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(reform) = 'object' THEN reform - 'deliveryAddress' ELSE reform END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "quotes"."forbid_issued_document_change"() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_demo THEN
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE'
    AND current_setting('app.retention_anonymization', true) = 'on'
    AND (to_jsonb(NEW) - 'buyer_snapshot' - 'reform_snapshot') = (to_jsonb(OLD) - 'buyer_snapshot' - 'reform_snapshot')
    AND "quotes"."reform_without_delivery"(to_jsonb(NEW) -> 'reform_snapshot') IS NOT DISTINCT FROM "quotes"."reform_without_delivery"(to_jsonb(OLD) -> 'reform_snapshot') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'document émis immuable (%) : correction par avoir', TG_TABLE_NAME
    USING ERRCODE = 'P0001';
END;
$$;
--> statement-breakpoint
GRANT UPDATE ("reform_snapshot") ON "quotes"."invoices", "quotes"."credit_notes" TO symbola_app;
