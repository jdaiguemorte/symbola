-- Lot 66b (JRJ-01, HUB-28 ; D2, D3) : le rappel du jour J réglé pour un évènement (coupé, ou une autre
-- heure, pour une cible) ; sans ligne, le réglage de l'organisation (hub.day_reminder_targets). Schéma
-- events seulement ; ajout seul : compatible avec l'image précédente (ARC-14).
CREATE TABLE "events"."day_reminder_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"target" text NOT NULL,
	"enabled" boolean NOT NULL,
	"moment" text NOT NULL,
	"send_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "day_reminder_overrides_target_check" CHECK ("events"."day_reminder_overrides"."target" in ('planner', 'vendors', 'team', 'clients')),
	CONSTRAINT "day_reminder_overrides_moment_check" CHECK ("events"."day_reminder_overrides"."moment" in ('eve', 'morning')),
	CONSTRAINT "day_reminder_overrides_time_check" CHECK (extract(minute from "events"."day_reminder_overrides"."send_time")::int % 15 = 0 and extract(second from "events"."day_reminder_overrides"."send_time") = 0)
);
--> statement-breakpoint
ALTER TABLE "events"."day_reminder_overrides" ADD CONSTRAINT "day_reminder_overrides_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "day_reminder_overrides_organization_idx" ON "events"."day_reminder_overrides" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "day_reminder_overrides_event_target_idx" ON "events"."day_reminder_overrides" USING btree ("event_id","target");
--> statement-breakpoint
ALTER TABLE "events"."day_reminder_overrides" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."day_reminder_overrides" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."day_reminder_overrides"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."day_reminder_overrides" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "day_reminder_overrides_stamp" BEFORE INSERT OR UPDATE ON "events"."day_reminder_overrides"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "day_reminder_overrides_journal_deletion" BEFORE DELETE ON "events"."day_reminder_overrides"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
