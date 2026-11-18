-- Annulation de 0165 (lot 43) : les modèles de proposition, les références de virement, les
-- déclarations des payeurs, les relances d'impayés et les réglages des relances sont perdus ; le mot
-- d'accueil figé de chaque version aussi. Les encaissements confirmés restent (payment_entries).
DROP TABLE "quotes"."payment_reminders";
--> statement-breakpoint
DROP TABLE "quotes"."payment_references";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP CONSTRAINT "quote_versions_proposal_greeting_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" DROP COLUMN "signing_code_verified_at";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN "expiry_reminded_at";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN "proposal_template_version";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN "proposal_template_id";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN "proposal_greeting";
--> statement-breakpoint
DROP TABLE "quotes"."proposal_templates";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP CONSTRAINT "quote_settings_consumer_late_penalty_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP CONSTRAINT "quote_settings_payment_reminder_days_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP CONSTRAINT "quote_settings_expiry_reminder_days_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "consumer_late_penalty_basis_points";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "payment_reminder_days";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "expiry_reminder_days";
