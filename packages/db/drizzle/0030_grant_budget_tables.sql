-- Row-Level Security sur les tables du module budget (CLAUDE.md §2.4,
-- même patron que hello.greetings, migration 0001).
ALTER TABLE "budget"."allocation_models" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."allocation_models" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."allocation_models"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."allocation_models" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "budget"."allocation_model_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."allocation_model_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."allocation_model_items"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."allocation_model_items" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "budget"."event_budgets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."event_budgets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."event_budgets"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."event_budgets" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "budget"."event_budget_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."event_budget_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."event_budget_items"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."event_budget_items" TO symbola_app;
