ALTER TABLE "budget"."allocation_model_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "budget"."allocation_model_items" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."allocation_model_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "budget"."allocation_model_items" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."allocation_models" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."allocation_models" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "budget"."allocation_models" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."budget_line_attachments" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."budget_line_attachments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "budget"."budget_line_attachments" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."budget_line_history" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."event_budget_items" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."event_budget_items" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."event_budgets" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."event_budgets" ADD COLUMN "updated_by" uuid;
--> statement-breakpoint
-- Lot 23 (DAT-06, SEC-19, ADR 0060) : auteur et dates sur chaque ligne du schéma
-- budget (core.stamp_row, ou core.stamp_created_row pour une table en ajout
-- seul) et suppressions journalisées (core.journal_deletion). Une ligne
-- existante prend pour date de modification sa date de création ; son auteur
-- reste inconnu (vide). Tables techniques exclues : packages/db/src/row-stamps.ts.
--> statement-breakpoint
CREATE TRIGGER "allocation_model_items_stamp" BEFORE INSERT OR UPDATE ON "budget"."allocation_model_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "allocation_model_items_journal_deletion" BEFORE DELETE ON "budget"."allocation_model_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "budget"."allocation_models" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "allocation_models_stamp" BEFORE INSERT OR UPDATE ON "budget"."allocation_models"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "allocation_models_journal_deletion" BEFORE DELETE ON "budget"."allocation_models"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "budget"."budget_line_attachments" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "budget_line_attachments_stamp" BEFORE INSERT OR UPDATE ON "budget"."budget_line_attachments"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "budget_line_attachments_journal_deletion" BEFORE DELETE ON "budget"."budget_line_attachments"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "budget_line_history_stamp" BEFORE INSERT OR UPDATE ON "budget"."budget_line_history"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "budget_line_history_journal_deletion" BEFORE DELETE ON "budget"."budget_line_history"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "budget_lines_stamp" BEFORE INSERT OR UPDATE ON "budget"."budget_lines"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "budget_lines_journal_deletion" BEFORE DELETE ON "budget"."budget_lines"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_budget_items_stamp" BEFORE INSERT OR UPDATE ON "budget"."event_budget_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_budget_items_journal_deletion" BEFORE DELETE ON "budget"."event_budget_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_budgets_stamp" BEFORE INSERT OR UPDATE ON "budget"."event_budgets"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_budgets_journal_deletion" BEFORE DELETE ON "budget"."event_budgets"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
