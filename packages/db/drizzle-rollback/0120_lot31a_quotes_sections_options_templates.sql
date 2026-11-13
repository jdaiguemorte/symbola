-- Annulation de 0120 (lot 31a) : sections, options, choix des options, modèles de devis
-- et choix acompte ou arrhes sont perdus ; les lignes des devis restent, sans section
-- (une option redevient une ligne ordinaire).
ALTER TABLE "quotes"."quote_versions" DROP CONSTRAINT "quote_versions_template_id_quote_templates_id_fk";
--> statement-breakpoint
DROP TABLE "quotes"."quote_template_schedule_items";
--> statement-breakpoint
DROP TABLE "quotes"."quote_template_lines";
--> statement-breakpoint
DROP TABLE "quotes"."quote_template_sections";
--> statement-breakpoint
DROP TABLE "quotes"."quote_templates";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN "advance_kind_default";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP CONSTRAINT "quote_versions_options_chosen_check";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN "template_version";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN "template_id";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN "options_chosen_by_kind";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN "options_chosen_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN "options_chosen_at";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN "advance_kind";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP CONSTRAINT "quote_lines_section_id_quote_sections_id_fk";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN "option_chosen";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN "is_option";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN "section_id";
--> statement-breakpoint
DROP TABLE "quotes"."quote_sections";
--> statement-breakpoint
DROP TYPE "quotes"."advance_kind";
