-- Annulation de 0212 (lot 70a) : « Cochée par » disparaît (déclencheur, colonnes, index). Acceptée : la date
-- de fin reste (done_at), seul l'auteur de la coche est perdu, que l'image précédente ne montre pas.
DROP TRIGGER IF EXISTS "event_tasks_done_by" ON "events"."event_tasks";
--> statement-breakpoint
DROP FUNCTION IF EXISTS "events"."task_done_by"();
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP CONSTRAINT IF EXISTS "event_tasks_done_by_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_tasks_done_at_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "done_by_user_id";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "done_by_kind";
