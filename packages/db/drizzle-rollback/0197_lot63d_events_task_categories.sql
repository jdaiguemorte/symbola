-- Annulation de 0197 (lot 63d) : catégories des tâches, catégorie et priorité des tâches disparaissent.
-- Refusée tant qu'une tâche porte une catégorie ou la priorité haute (le classement fait par la planner
-- serait perdu) : la planner retire ces réglages avant. Les catégories seules (celles de départ ou
-- créées sans servir) partent avec la table : elles se recréent depuis les Paramètres.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_tasks" WHERE "category_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des tâches ont une catégorie (events.event_tasks.category_id).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_tasks" WHERE "priority" <> 'normal') THEN
    RAISE EXCEPTION 'Annulation refusée : des tâches ont la priorité haute (events.event_tasks.priority).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP CONSTRAINT IF EXISTS "event_tasks_priority_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_tasks_category_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "priority";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "category_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."task_categories";
