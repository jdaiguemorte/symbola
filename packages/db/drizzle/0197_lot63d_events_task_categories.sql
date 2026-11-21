-- Lot 63d (CHR-02, CHR-03, HUB-20 ; recette de la wedding planner du 21/11/2026, accord de Julien du
-- 21/11) : catégories des tâches de l'organisation (libellé, couleur, rang ; départ en données : Client,
-- Prestataires, Administratif, Jour J) et, sur chaque tâche, une catégorie facultative et une priorité
-- (« high » ou « normal », par défaut « normal »). Schéma events seulement. Ajout seul : compatible avec
-- la version précédente du code (ARC-14), qui ignore cette table et ces deux colonnes.
CREATE TABLE "events"."task_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"starter_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "task_categories_organization_starter_key_unique" UNIQUE("organization_id","starter_key"),
	CONSTRAINT "task_categories_label_check" CHECK (char_length(btrim("events"."task_categories"."label")) between 1 and 60),
	CONSTRAINT "task_categories_color_check" CHECK ("events"."task_categories"."color" ~ '^#[0-9a-f]{6}$')
);
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
CREATE INDEX "task_categories_organization_idx" ON "events"."task_categories" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD CONSTRAINT "event_tasks_category_id_task_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "events"."task_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_tasks_category_idx" ON "events"."event_tasks" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD CONSTRAINT "event_tasks_priority_check" CHECK ("events"."event_tasks"."priority" in ('high', 'normal'));

--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées. Une
-- catégorie retirée laisse ses tâches sans catégorie (clé étrangère « set null », même schéma).
--> statement-breakpoint
ALTER TABLE "events"."task_categories" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."task_categories" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."task_categories"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."task_categories" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "task_categories_stamp" BEFORE INSERT OR UPDATE ON "events"."task_categories"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "task_categories_journal_deletion" BEFORE DELETE ON "events"."task_categories"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
