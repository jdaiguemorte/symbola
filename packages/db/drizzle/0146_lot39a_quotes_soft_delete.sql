-- Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) : suppression logique dans le schéma quotes (devis
-- d'un évènement supprimé, lignes de devis, modèles de devis et de contrat).
ALTER TABLE "quotes"."contract_templates" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes"."contract_templates" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_templates" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes"."quote_templates" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD COLUMN "deleted_by" uuid;
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "quotes"."quotes" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "quotes"."quote_lines" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "quotes"."quote_templates" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "quotes"."contract_templates" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
