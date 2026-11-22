-- Lot 66a et 66b (HUB-28, JRJ-01 ; décisions D1 à D4 de Julien du 22/11/2026) : l'heure d'envoi.
-- - hub.automations.send_time : heure propre d'un automatisme (nulle : l'heure par défaut) ;
-- - hub.sending_settings : l'heure d'envoi par défaut de l'organisation (sans ligne : 09:00) ;
-- - hub.day_reminder_targets : le rappel du jour J par cible (planner, prestataires, équipe,
--   clients), la veille ou le matin même, à une heure ; nouvel automatisme « day_reminder ».
-- Heures au quart d'heure. Schéma hub seulement ; ajouts seuls : compatible avec l'image précédente
-- (ARC-14).
CREATE TABLE "hub"."day_reminder_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"target" text NOT NULL,
	"enabled" boolean NOT NULL,
	"moment" text NOT NULL,
	"send_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "day_reminder_targets_target_check" CHECK ("hub"."day_reminder_targets"."target" in ('planner', 'vendors', 'team', 'clients')),
	CONSTRAINT "day_reminder_targets_moment_check" CHECK ("hub"."day_reminder_targets"."moment" in ('eve', 'morning')),
	CONSTRAINT "day_reminder_targets_time_check" CHECK (extract(minute from "hub"."day_reminder_targets"."send_time")::int % 15 = 0 and extract(second from "hub"."day_reminder_targets"."send_time") = 0)
);
--> statement-breakpoint
CREATE TABLE "hub"."sending_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"default_send_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "sending_settings_time_check" CHECK (extract(minute from "hub"."sending_settings"."default_send_time")::int % 15 = 0 and extract(second from "hub"."sending_settings"."default_send_time") = 0)
);
--> statement-breakpoint
ALTER TABLE "hub"."automation_runs" DROP CONSTRAINT "automation_runs_key_check";--> statement-breakpoint
ALTER TABLE "hub"."automations" DROP CONSTRAINT "automations_key_check";--> statement-breakpoint
ALTER TABLE "hub"."automations" ADD COLUMN "send_time" time;--> statement-breakpoint
ALTER TABLE "hub"."sending_settings" ADD CONSTRAINT "sending_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "day_reminder_targets_organization_idx" ON "hub"."day_reminder_targets" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "day_reminder_targets_target_idx" ON "hub"."day_reminder_targets" USING btree ("organization_id","target");--> statement-breakpoint
ALTER TABLE "hub"."automation_runs" ADD CONSTRAINT "automation_runs_key_check" CHECK ("hub"."automation_runs"."key" in ('quote_signed_confirm_event', 'payment_due_reminder', 'rsvp_reminder', 'client_task_reminder', 'invoice_reminder', 'proposal_expiry_reminder', 'prospect_follow_up', 'vendor_roadmap', 'risk_radar', 'day_reminder'));--> statement-breakpoint
ALTER TABLE "hub"."automations" ADD CONSTRAINT "automations_send_time_check" CHECK ("hub"."automations"."send_time" is null or (extract(minute from "hub"."automations"."send_time")::int % 15 = 0 and extract(second from "hub"."automations"."send_time") = 0));--> statement-breakpoint
ALTER TABLE "hub"."automations" ADD CONSTRAINT "automations_key_check" CHECK ("hub"."automations"."key" in ('quote_signed_confirm_event', 'payment_due_reminder', 'rsvp_reminder', 'client_task_reminder', 'invoice_reminder', 'proposal_expiry_reminder', 'prospect_follow_up', 'vendor_roadmap', 'risk_radar', 'day_reminder'));
--> statement-breakpoint
ALTER TABLE "hub"."sending_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."sending_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."sending_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."sending_settings" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "sending_settings_stamp" BEFORE INSERT OR UPDATE ON "hub"."sending_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "sending_settings_journal_deletion" BEFORE DELETE ON "hub"."sending_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "hub"."day_reminder_targets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."day_reminder_targets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."day_reminder_targets"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."day_reminder_targets" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "day_reminder_targets_stamp" BEFORE INSERT OR UPDATE ON "hub"."day_reminder_targets"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "day_reminder_targets_journal_deletion" BEFORE DELETE ON "hub"."day_reminder_targets"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
