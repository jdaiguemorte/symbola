-- Annulation de 0121 (lot 31a) : assurance, médiateur et conditions générales saisis sont
-- perdus ; la liste des mentions réglée par l'Admin aussi (la liste de départ reste).
ALTER TABLE "hub"."platform_settings" DROP COLUMN "required_mentions";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT "organization_profiles_general_terms_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "general_terms";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT "organization_profiles_mediator_url_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "mediator_url";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT "organization_profiles_mediator_name_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "mediator_name";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT "organization_profiles_insurance_coverage_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "insurance_coverage";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT "organization_profiles_insurance_policy_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "insurance_policy";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT "organization_profiles_insurer_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "insurer";
