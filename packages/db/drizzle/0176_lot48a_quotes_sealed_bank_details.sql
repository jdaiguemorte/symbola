-- Lot 48a (DAT-08 ; D5, ADR 0093) : IBAN et BIC de la planner chiffrés au niveau du champ. Cette
-- migration ajoute les colonnes chiffrées ; l'étape de données qui la suit (packages/db/scripts/
-- data-steps.ts, lancée par migrate.ts avec DATA_ENCRYPTION_KEY) chiffre les valeurs en clair et vide
-- iban et bic. Son annulation déchiffre et remet les valeurs en clair avant de retirer les colonnes.
-- symbola: arret-requis l'IBAN et le BIC de la planner passent chiffrés : l'ancienne version ne les lirait plus
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "iban_sealed" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "bic_sealed" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD CONSTRAINT "quote_settings_sealed_bank_check" CHECK (("quotes"."quote_settings"."iban_sealed" is null or ("quotes"."quote_settings"."iban_sealed" like 'f1:%' and "quotes"."quote_settings"."iban" is null)) and ("quotes"."quote_settings"."bic_sealed" is null or ("quotes"."quote_settings"."bic_sealed" like 'f1:%' and "quotes"."quote_settings"."bic" is null)));
