-- Lot 71a (HUB-14, P-01, P-06, C-64 ; spécification du lot 71, § 4.2 ; ADR 0119) : ce que le fichier
-- ne dit pas reste « non renseigné ».
-- - events.events.origin : « created » ou « takeover » (créé par une reprise) ; filtre « Origine » et
--   étiquette « Repris » lus dans le module. Les évènements existants sont « created » (décision I8).
-- - events.event_status_history.date_known : faux pour un statut repris, daté du jour de l'import.
-- - events.event_tasks.done_date_known : faux pour une tâche reprise déjà faite ; done_at garde l'heure
--   de l'import (tris, contrainte event_tasks_done_by_check du lot 70a).
-- Compatible avec l'image précédente : colonnes avec une valeur par défaut, un index, une contrainte
-- que toutes les lignes respectent (ARC-14).
ALTER TABLE "events"."event_status_history" ADD COLUMN "date_known" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "done_date_known" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "origin" text DEFAULT 'created' NOT NULL;--> statement-breakpoint
CREATE INDEX "events_origin_idx" ON "events"."events" USING btree ("organization_id","origin");--> statement-breakpoint
ALTER TABLE "events"."events" ADD CONSTRAINT "events_origin_check" CHECK ("events"."events"."origin" in ('created', 'takeover'));
