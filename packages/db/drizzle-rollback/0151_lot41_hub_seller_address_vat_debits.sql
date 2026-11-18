-- Annulation de 0151 (lot 41) : le code postal, la ville et le pays du vendeur, l'option pour la TVA
-- sur les débits et les vérifications désactivées par l'Admin sont perdus. L'adresse (ligne) reste.
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT IF EXISTS "organization_profiles_country_code_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT IF EXISTS "organization_profiles_city_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT IF EXISTS "organization_profiles_postal_code_check";
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" DROP COLUMN IF EXISTS "compliance_checks";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "vat_on_debits_from";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "vat_on_debits";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "country_code";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "city";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "postal_code";
