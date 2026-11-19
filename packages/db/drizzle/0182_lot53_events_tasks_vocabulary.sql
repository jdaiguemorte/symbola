-- Lot 53 (CHR-10, CHR-05, HUB-24 ; D6, D8 ; ADR 0095) : tâches hors évènement et récurrentes, jalons,
-- seuils de la santé du planning, terme des clients par type d'évènement. Schéma events seulement.
-- event_tasks.event_id devient facultatif (une tâche hors évènement : déclaration de TVA, assurance),
-- avec sa répétition (chaque semaine, mois, trimestre, année ; seulement hors évènement) et la marque
-- de jalon. Une tâche hors évènement n'a ni date relative, ni prestataire, ni autre responsable que la
-- planner. La politique event_visibility d'event_tasks admet déjà event_id nul (migration 0144).
-- Ajout seul et contrainte relâchée : compatible avec la version précédente du code (ARC-14), qui ne
-- lit les tâches que par leur évènement.
CREATE TABLE "events"."event_type_vocabulary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"term" text NOT NULL,
	"gender" text NOT NULL,
	"number" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_type_vocabulary_locale_check" CHECK ("events"."event_type_vocabulary"."locale" in ('fr', 'en')),
	CONSTRAINT "event_type_vocabulary_term_check" CHECK (char_length(btrim("events"."event_type_vocabulary"."term")) between 1 and 40),
	CONSTRAINT "event_type_vocabulary_gender_check" CHECK ("events"."event_type_vocabulary"."gender" in ('masculine', 'feminine', 'neuter')),
	CONSTRAINT "event_type_vocabulary_number_check" CHECK ("events"."event_type_vocabulary"."number" in ('singular', 'plural'))
);
--> statement-breakpoint
CREATE TABLE "events"."planning_health_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"watch_points" integer NOT NULL,
	"late_points" integer NOT NULL,
	"milestone_weight" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "planning_health_settings_points_check" CHECK ("events"."planning_health_settings"."watch_points" between 1 and 100 and "events"."planning_health_settings"."late_points" between 1 and 100 and "events"."planning_health_settings"."watch_points" <= "events"."planning_health_settings"."late_points"),
	CONSTRAINT "planning_health_settings_weight_check" CHECK ("events"."planning_health_settings"."milestone_weight" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ALTER COLUMN "event_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "recurrence" text;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "recurrence_spawned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "is_milestone" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_type_vocabulary" ADD CONSTRAINT "event_type_vocabulary_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "events"."event_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_type_vocabulary_organization_idx" ON "events"."event_type_vocabulary" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_type_vocabulary_type_locale_idx" ON "events"."event_type_vocabulary" USING btree ("event_type_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_health_settings_organization_idx" ON "events"."planning_health_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_tasks_event_idx" ON "events"."event_tasks" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD CONSTRAINT "event_tasks_recurrence_check" CHECK ("events"."event_tasks"."recurrence" is null or ("events"."event_tasks"."recurrence" in ('weekly', 'monthly', 'quarterly', 'yearly') and "events"."event_tasks"."event_id" is null));--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD CONSTRAINT "event_tasks_standalone_check" CHECK ("events"."event_tasks"."event_id" is not null or ("events"."event_tasks"."offset_days" is null and "events"."event_tasks"."vendor_candidate_id" is null and "events"."event_tasks"."follow_up_candidate_id" is null and "events"."event_tasks"."is_milestone" = false and "events"."event_tasks"."responsible" = 'planner'));
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées.
--> statement-breakpoint
ALTER TABLE "events"."event_type_vocabulary" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_type_vocabulary" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_type_vocabulary"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_type_vocabulary" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "event_type_vocabulary_stamp" BEFORE INSERT OR UPDATE ON "events"."event_type_vocabulary"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_type_vocabulary_journal_deletion" BEFORE DELETE ON "events"."event_type_vocabulary"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."planning_health_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."planning_health_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."planning_health_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."planning_health_settings" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "planning_health_settings_stamp" BEFORE INSERT OR UPDATE ON "events"."planning_health_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "planning_health_settings_journal_deletion" BEFORE DELETE ON "events"."planning_health_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
