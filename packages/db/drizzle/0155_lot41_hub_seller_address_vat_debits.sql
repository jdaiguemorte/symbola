-- Lot 41 (FAC-10, JUR-02, GC-03 ; D7, D10, D12) : adresse structurée du vendeur, option pour la TVA
-- sur les débits datée, vérifications de l'assistant de conformité désactivées par l'Admin. Ajouts
-- seulement ; aucune donnée devinée (l'ancienne adresse reste la ligne d'adresse, D7).
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "country_code" text DEFAULT 'FR' NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "vat_on_debits" boolean;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "vat_on_debits_from" date;--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "compliance_checks" jsonb;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_postal_code_check" CHECK ("hub"."organization_profiles"."postal_code" is null or char_length("hub"."organization_profiles"."postal_code") between 1 and 16);--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_city_check" CHECK ("hub"."organization_profiles"."city" is null or char_length("hub"."organization_profiles"."city") between 1 and 120);--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_country_code_check" CHECK ("hub"."organization_profiles"."country_code" ~ '^[A-Z]{2}$');
