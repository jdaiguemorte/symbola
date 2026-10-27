-- Row-Level Security sur les tables de la signature en ligne (DEV-02,
-- CLAUDE.md §2.4, même patron que 0036_grant_devis.sql).
ALTER TABLE "quotes"."signature_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."signature_requests"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."signature_requests" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "quotes"."quote_signers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."quote_signers"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."quote_signers" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "quotes"."signature_webhook_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."signature_webhook_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."signature_webhook_log"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."signature_webhook_log" TO symbola_app;
