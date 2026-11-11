-- Annulation de 0098 (lot 24a, DAT-01) : index sur organization_id du schéma budget.
-- Aucune donnée touchée.
DROP INDEX IF EXISTS "budget"."allocation_model_items_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "budget"."allocation_models_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "budget"."budget_line_attachments_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "budget"."budget_line_history_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "budget"."budget_lines_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "budget"."event_budget_items_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "budget"."event_budgets_organization_idx";
