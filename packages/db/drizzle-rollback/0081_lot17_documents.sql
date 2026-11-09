-- Annulation de 0081 (lot 17, ADR 0046) : fiche entreprise des documents et
-- apparence des devis et factures. Les réglages saisis depuis sont perdus ;
-- les instantanés des documents déjà émis gardent leurs champs du lot 17,
-- ignorés par les versions antérieures de l'app.
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "document_footer";
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "invoice_intro";
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "quote_terms";
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "quote_intro";
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "bic";
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "iban";
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "document_font";
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "document_color";
DROP TYPE "quotes"."document_font";
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "share_capital_cents";
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "registration";
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "vat_number";
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "website";
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "contact_phone";
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "contact_email";
