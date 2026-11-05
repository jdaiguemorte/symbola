-- Lot 12 (EVT-15) : Row-Level Security et droits du rôle applicatif sur les
-- lieux d'un événement. Même patron que la migration 0063.
ALTER TABLE "events"."event_places" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_places" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_places"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_places" TO symbola_app;
