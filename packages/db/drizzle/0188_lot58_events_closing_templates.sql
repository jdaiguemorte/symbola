-- Lot 58 (PAR-09, EVT-08 ; D4, D5 ; ADR 0097) : clôture d'un évènement (étapes, temps passé facultatif,
-- trois leçons, frais propres de la planner, budget final figé, demande d'avis), réglages de la clôture
-- (lien d'avis de la planner), modèles d'évènement (structures seulement) et archivage (lecture seule,
-- hors des listes courantes). Schéma events seulement. Ajout seul : compatible avec la version
-- précédente du code (ARC-14), qui ignore ces tables et ces deux colonnes.
CREATE TABLE "events"."closing_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"review_url" text,
	"review_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "closing_settings_review_url_check" CHECK ("events"."closing_settings"."review_url" is null or ("events"."closing_settings"."review_url" like 'https://%' and char_length("events"."closing_settings"."review_url") <= 500)),
	CONSTRAINT "closing_settings_review_label_check" CHECK ("events"."closing_settings"."review_label" is null or char_length("events"."closing_settings"."review_label") between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "events"."event_closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"checked_steps" text[] DEFAULT '{}'::text[] NOT NULL,
	"time_spent_minutes" integer,
	"lessons" text[] DEFAULT '{}'::text[] NOT NULL,
	"own_expenses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget_snapshot" jsonb,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"review_requested_at" timestamp with time zone,
	"review_request_kind" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_closings_time_spent_check" CHECK ("events"."event_closings"."time_spent_minutes" is null or "events"."event_closings"."time_spent_minutes" between 0 and 360000),
	CONSTRAINT "event_closings_lessons_check" CHECK (cardinality("events"."event_closings"."lessons") <= 10),
	CONSTRAINT "event_closings_expenses_check" CHECK (jsonb_typeof("events"."event_closings"."own_expenses") = 'array' and jsonb_array_length("events"."event_closings"."own_expenses") <= 100),
	CONSTRAINT "event_closings_review_check" CHECK (("events"."event_closings"."review_request_kind" is null or "events"."event_closings"."review_request_kind" in ('thanks', 'thanks_with_review')) and (("events"."event_closings"."review_requested_at" is null) = ("events"."event_closings"."review_request_kind" is null))),
	CONSTRAINT "event_closings_closed_check" CHECK (("events"."event_closings"."closed_at" is null) = ("events"."event_closings"."budget_snapshot" is null))
);
--> statement-breakpoint
CREATE TABLE "events"."event_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"event_type_id" uuid,
	"source_event_id" uuid,
	"includes_vendors" boolean DEFAULT false NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_templates_name_check" CHECK (char_length(btrim("events"."event_templates"."name")) between 1 and 120),
	CONSTRAINT "event_templates_content_check" CHECK (jsonb_typeof("events"."event_templates"."content") = 'object')
);
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "archived_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_closings" ADD CONSTRAINT "event_closings_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_templates" ADD CONSTRAINT "event_templates_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "events"."event_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_templates" ADD CONSTRAINT "event_templates_source_event_id_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "events"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "closing_settings_organization_idx" ON "events"."closing_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_closings_organization_idx" ON "events"."event_closings" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_closings_event_idx" ON "events"."event_closings" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_templates_organization_idx" ON "events"."event_templates" USING btree ("organization_id");
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées. Une
-- clôture suit la visibilité de son évènement (équipe d'évènement, lot 52).
--> statement-breakpoint
ALTER TABLE "events"."event_closings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_closings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_closings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_closings" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_closings.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_closings" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "event_closings_stamp" BEFORE INSERT OR UPDATE ON "events"."event_closings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_closings_journal_deletion" BEFORE DELETE ON "events"."event_closings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."closing_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."closing_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."closing_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."closing_settings" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "closing_settings_stamp" BEFORE INSERT OR UPDATE ON "events"."closing_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "closing_settings_journal_deletion" BEFORE DELETE ON "events"."closing_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."event_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_templates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_templates" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "event_templates_stamp" BEFORE INSERT OR UPDATE ON "events"."event_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_templates_journal_deletion" BEFORE DELETE ON "events"."event_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
