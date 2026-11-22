-- Lot 64 (HUB-29, RDV-02 ; D1, D2, D6 ; ADR 0109) : plages occupées. Une règle par type d'évènement
-- (nulle = celle de départ de sa clé, event-types.json), un réglage propre par évènement (nul = la
-- règle de son type) et les réglages de l'organisation (règle des évènements sans type, une option
-- bloque-t-elle l'agenda). Début et fin : un jour relatif à la date de l'évènement (-7 à 7) et une
-- heure locale ; les quatre valeurs vont ensemble, la fin vient après le début. Schéma events
-- seulement. Ajout seul : compatible avec la version précédente du code (ARC-14).
CREATE TABLE "events"."busy_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"options_block" boolean NOT NULL,
	"fallback_start_day_offset" integer NOT NULL,
	"fallback_start_time" time NOT NULL,
	"fallback_end_day_offset" integer NOT NULL,
	"fallback_end_time" time NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "busy_settings_busy_rule_check" CHECK ("events"."busy_settings"."fallback_start_day_offset" between -7 and 7 and "events"."busy_settings"."fallback_end_day_offset" between -7 and 7 and ("events"."busy_settings"."fallback_end_day_offset" * 1440 + extract(epoch from "events"."busy_settings"."fallback_end_time") / 60) > ("events"."busy_settings"."fallback_start_day_offset" * 1440 + extract(epoch from "events"."busy_settings"."fallback_start_time") / 60))
);
--> statement-breakpoint
ALTER TABLE "events"."event_types" ADD COLUMN "busy_start_day_offset" integer;--> statement-breakpoint
ALTER TABLE "events"."event_types" ADD COLUMN "busy_start_time" time;--> statement-breakpoint
ALTER TABLE "events"."event_types" ADD COLUMN "busy_end_day_offset" integer;--> statement-breakpoint
ALTER TABLE "events"."event_types" ADD COLUMN "busy_end_time" time;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "busy_start_day_offset" integer;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "busy_start_time" time;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "busy_end_day_offset" integer;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "busy_end_time" time;--> statement-breakpoint
CREATE UNIQUE INDEX "busy_settings_organization_idx" ON "events"."busy_settings" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "events"."event_types" ADD CONSTRAINT "event_types_busy_rule_complete_check" CHECK (("events"."event_types"."busy_start_day_offset" is null) = ("events"."event_types"."busy_start_time" is null) and ("events"."event_types"."busy_start_day_offset" is null) = ("events"."event_types"."busy_end_day_offset" is null) and ("events"."event_types"."busy_start_day_offset" is null) = ("events"."event_types"."busy_end_time" is null));--> statement-breakpoint
ALTER TABLE "events"."event_types" ADD CONSTRAINT "event_types_busy_rule_check" CHECK ("events"."event_types"."busy_start_day_offset" is null or ("events"."event_types"."busy_start_day_offset" between -7 and 7 and "events"."event_types"."busy_end_day_offset" between -7 and 7 and ("events"."event_types"."busy_end_day_offset" * 1440 + extract(epoch from "events"."event_types"."busy_end_time") / 60) > ("events"."event_types"."busy_start_day_offset" * 1440 + extract(epoch from "events"."event_types"."busy_start_time") / 60)));--> statement-breakpoint
ALTER TABLE "events"."events" ADD CONSTRAINT "events_busy_rule_complete_check" CHECK (("events"."events"."busy_start_day_offset" is null) = ("events"."events"."busy_start_time" is null) and ("events"."events"."busy_start_day_offset" is null) = ("events"."events"."busy_end_day_offset" is null) and ("events"."events"."busy_start_day_offset" is null) = ("events"."events"."busy_end_time" is null));--> statement-breakpoint
ALTER TABLE "events"."events" ADD CONSTRAINT "events_busy_rule_check" CHECK ("events"."events"."busy_start_day_offset" is null or ("events"."events"."busy_start_day_offset" between -7 and 7 and "events"."events"."busy_end_day_offset" between -7 and 7 and ("events"."events"."busy_end_day_offset" * 1440 + extract(epoch from "events"."events"."busy_end_time") / 60) > ("events"."events"."busy_start_day_offset" * 1440 + extract(epoch from "events"."events"."busy_start_time") / 60)));
--> statement-breakpoint
ALTER TABLE "events"."busy_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."busy_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."busy_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."busy_settings" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "busy_settings_stamp" BEFORE INSERT OR UPDATE ON "events"."busy_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "busy_settings_journal_deletion" BEFORE DELETE ON "events"."busy_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
