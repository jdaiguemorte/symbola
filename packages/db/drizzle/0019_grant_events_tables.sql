-- Row-Level Security sur les tables du module events (CLAUDE.md §2.4,
-- même patron que hello.greetings, migration 0001). FORCE RLS pour que
-- même le rôle admin soit filtré ; seule une session sans BYPASSRLS qui
-- fixe app.organization_id voit des lignes.
ALTER TABLE "events"."events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."events"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."events" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "events"."event_clients" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_clients" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_clients"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_clients" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "events"."event_status_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_status_history"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_status_history" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "events"."prospect_sources" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."prospect_sources" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."prospect_sources"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."prospect_sources" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "events"."loss_reasons" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."loss_reasons" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."loss_reasons"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."loss_reasons" TO symbola_app;
