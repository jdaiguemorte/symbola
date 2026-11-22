-- Annulation de 0207 (lot 66b) : les réglages du rappel du jour J propres à un évènement disparaissent.
-- Refusée tant qu'un réglage existe (il serait perdu sans que la planner le sache).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."day_reminder_overrides") THEN
    RAISE EXCEPTION 'Annulation refusée : des évènements ont un rappel du jour J réglé (events.day_reminder_overrides).';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."day_reminder_overrides";
