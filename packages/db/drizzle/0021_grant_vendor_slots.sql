-- Row-Level Security et droits du rôle applicatif sur les tables EVT-03
-- (CLAUDE.md §2.4), même patron que 0019_grant_events_tables.sql.
ALTER TABLE "events"."default_vendor_slots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."default_vendor_slots" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."default_vendor_slots"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."default_vendor_slots" TO symbola_app;
--> statement-breakpoint

ALTER TABLE "events"."event_vendor_slots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_vendor_slots"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_vendor_slots" TO symbola_app;
