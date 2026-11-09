-- Lot 17 (ADR 0046) : fiche entreprise des documents (DEV-07) et apparence,
-- textes et paiement des devis et factures (DEV-09 à DEV-11). Colonnes
-- facultatives : les documents déjà émis gardent leur instantané.
CREATE TYPE "quotes"."document_font" AS ENUM('modern', 'classic');--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "contact_phone" text;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "vat_number" text;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "registration" text;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "share_capital_cents" bigint;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "document_color" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "document_font" "quotes"."document_font" DEFAULT 'modern' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "iban" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "bic" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "quote_intro" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "quote_terms" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "invoice_intro" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "document_footer" text;