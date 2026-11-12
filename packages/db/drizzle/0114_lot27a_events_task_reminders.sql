-- Lot 27a (CHR-04, décision D7) : rappels par e-mail des tâches confiées au
-- client. Case par lien (cochée par défaut) et langue de ses e-mails ; trace de
-- chaque rappel envoyé (tâche, lien, seuil) pour ne jamais l'envoyer deux fois.
-- Table technique.
ALTER TABLE "events"."event_links" ADD COLUMN "task_reminders" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD COLUMN "locale" text DEFAULT 'fr' NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_locale_check" CHECK ("events"."event_links"."locale" in ('fr', 'en'));
--> statement-breakpoint
CREATE TABLE "events"."event_task_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"threshold" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_task_reminders_unique" UNIQUE("task_id","link_id","threshold"),
	CONSTRAINT "event_task_reminders_threshold_check" CHECK ("events"."event_task_reminders"."threshold" in ('week', 'eve', 'overdue'))
);
--> statement-breakpoint
ALTER TABLE "events"."event_task_reminders" ADD CONSTRAINT "event_task_reminders_task_id_event_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "events"."event_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events"."event_task_reminders" ADD CONSTRAINT "event_task_reminders_link_id_event_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "events"."event_links"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_task_reminders_organization_idx" ON "events"."event_task_reminders" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "event_task_reminders_link_idx" ON "events"."event_task_reminders" USING btree ("link_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."event_task_reminders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_task_reminders" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_task_reminders"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_task_reminders" TO symbola_app;
