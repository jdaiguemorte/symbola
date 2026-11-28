-- Annulation de 0245 (lot 74b) : la marque « à dater » disparaît. Refusée tant qu'une tâche est « à dater » :
-- l'image précédente lirait sa date technique (la date de l'évènement) comme une vraie échéance.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_tasks" WHERE NOT due_date_known) THEN
    RAISE EXCEPTION 'annulation refusée : des tâches sont « à dater »' USING ERRCODE = 'P0001';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "due_date_known";
