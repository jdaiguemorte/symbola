-- Annulation de 0090 (lot 23, DAT-06, ADR 0060) : retire les déclencheurs du schéma
-- budget et les colonnes d'auteur et de dates ajoutées par le lot 23 (les
-- auteurs enregistrés depuis sont perdus ; lancer après une sauvegarde).
DROP TRIGGER IF EXISTS "allocation_model_items_stamp" ON "budget"."allocation_model_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "allocation_model_items_journal_deletion" ON "budget"."allocation_model_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "allocation_models_stamp" ON "budget"."allocation_models";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "allocation_models_journal_deletion" ON "budget"."allocation_models";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "budget_line_attachments_stamp" ON "budget"."budget_line_attachments";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "budget_line_attachments_journal_deletion" ON "budget"."budget_line_attachments";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "budget_line_history_stamp" ON "budget"."budget_line_history";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "budget_line_history_journal_deletion" ON "budget"."budget_line_history";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "budget_lines_stamp" ON "budget"."budget_lines";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "budget_lines_journal_deletion" ON "budget"."budget_lines";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_budget_items_stamp" ON "budget"."event_budget_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_budget_items_journal_deletion" ON "budget"."event_budget_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_budgets_stamp" ON "budget"."event_budgets";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_budgets_journal_deletion" ON "budget"."event_budgets";
--> statement-breakpoint
ALTER TABLE "budget"."allocation_model_items" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "budget"."allocation_model_items" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "budget"."allocation_model_items" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "budget"."allocation_model_items" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "budget"."allocation_models" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "budget"."allocation_models" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "budget"."allocation_models" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_attachments" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_attachments" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_attachments" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_history" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "budget"."event_budget_items" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "budget"."event_budget_items" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "budget"."event_budgets" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "budget"."event_budgets" DROP COLUMN IF EXISTS "updated_by";
