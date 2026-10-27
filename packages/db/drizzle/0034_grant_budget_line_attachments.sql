-- Row-Level Security sur budget_line_attachments (BUD-03, CLAUDE.md §2.4,
-- même patron que 0032_grant_budget_lines.sql).
ALTER TABLE "budget"."budget_line_attachments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_attachments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "budget"."budget_line_attachments"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "budget"."budget_line_attachments" TO symbola_app;
