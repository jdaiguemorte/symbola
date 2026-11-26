-- Annulation de 0211 (lot 70a) : la personne qui s'en charge disparaît des tâches. Acceptée même quand des
-- tâches sont confiées : l'image précédente ne connaît que « planner », que la colonne précise (la
-- répartition entre collègues est perdue, rien d'autre). Les annulations de 0212 à 0217 passent avant.
ALTER TABLE "events"."event_tasks" DROP CONSTRAINT IF EXISTS "event_tasks_assignee_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_tasks_assignee_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "assignee_user_id";
