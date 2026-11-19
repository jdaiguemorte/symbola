-- Annulation de 0182 (lot 53) : les tâches retrouvent un évènement obligatoire, sans répétition ni
-- jalon ; les termes des clients et les seuils de santé disparaissent. Refusée tant qu'une tâche hors
-- évènement existe (elle ne pourrait pas rester), ou qu'un terme des clients est réglé (il serait perdu) :
-- la planner les supprime ou les note avant l'annulation. La marque de jalon et les seuils de santé
-- reviennent à l'état d'avant (tâches ordinaires, valeurs de départ).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_tasks" WHERE "event_id" IS NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des tâches hors évènement existent (events.event_tasks.event_id nul).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_type_vocabulary") THEN
    RAISE EXCEPTION 'Annulation refusée : des termes des clients sont réglés (events.event_type_vocabulary).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP CONSTRAINT IF EXISTS "event_tasks_standalone_check";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP CONSTRAINT IF EXISTS "event_tasks_recurrence_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_tasks_event_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "is_milestone";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "recurrence_spawned_at";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "recurrence";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ALTER COLUMN "event_id" SET NOT NULL;
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."planning_health_settings";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."event_type_vocabulary";
