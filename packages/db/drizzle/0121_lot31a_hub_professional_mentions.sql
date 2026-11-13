-- Lot 31a (JUR-09, FAC-07, JUR-01 ; décision D4) : informations du professionnel reprises
-- sur les documents (assurance de responsabilité civile professionnelle, médiateur de la
-- consommation, conditions générales de vente), et liste des mentions requises réglée par
-- l'Admin (null : liste de départ de packages/starter-templates, à valider par
-- l'expert-comptable).
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "insurer" text;
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_insurer_check" CHECK ("hub"."organization_profiles"."insurer" is null or char_length("hub"."organization_profiles"."insurer") between 1 and 120);
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "insurance_policy" text;
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_insurance_policy_check" CHECK ("hub"."organization_profiles"."insurance_policy" is null or char_length("hub"."organization_profiles"."insurance_policy") between 1 and 80);
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "insurance_coverage" text;
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_insurance_coverage_check" CHECK ("hub"."organization_profiles"."insurance_coverage" is null or char_length("hub"."organization_profiles"."insurance_coverage") between 1 and 200);
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "mediator_name" text;
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_mediator_name_check" CHECK ("hub"."organization_profiles"."mediator_name" is null or char_length("hub"."organization_profiles"."mediator_name") between 1 and 160);
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "mediator_url" text;
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_mediator_url_check" CHECK ("hub"."organization_profiles"."mediator_url" is null or char_length("hub"."organization_profiles"."mediator_url") between 1 and 300);
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "general_terms" text;
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD CONSTRAINT "organization_profiles_general_terms_check" CHECK ("hub"."organization_profiles"."general_terms" is null or char_length("hub"."organization_profiles"."general_terms") between 1 and 20000);
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "required_mentions" jsonb;
