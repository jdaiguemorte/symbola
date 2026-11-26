-- Annulation de 0213 (lot 70a) : la note des tâches disparaît. Refusée tant qu'une tâche a une note (le
-- texte de la planner serait perdu sans qu'elle le sache) : elle le recopie ou l'efface avant.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_tasks" WHERE "note" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des tâches ont une note (events.event_tasks.note).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP CONSTRAINT IF EXISTS "event_tasks_note_check";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "note";
