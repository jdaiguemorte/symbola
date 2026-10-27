-- Row-Level Security sur budget_lines/budget_line_history (BUD-02,
-- CLAUDE.md §2.4, même patron que hello.greetings, migration 0001).
ALTER TABLE "budget"."budget_lines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."budget_lines"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."budget_lines" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "budget"."budget_line_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_history" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."budget_line_history"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."budget_line_history" TO symbola_app;
