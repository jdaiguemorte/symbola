-- Annulation de 0220 (lot 71a) : l'origine des évènements et les marques « date non renseignée »
-- disparaissent. Refusée tant qu'un évènement repris existe : l'image précédente le montrerait comme
-- créé dans Symbola, et ses dates techniques comme de vraies dates.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."events" WHERE origin <> 'created')
    OR EXISTS (SELECT 1 FROM "events"."event_status_history" WHERE NOT date_known)
    OR EXISTS (SELECT 1 FROM "events"."event_tasks" WHERE NOT done_date_known) THEN
    RAISE EXCEPTION 'annulation refusée : des évènements, statuts ou tâches repris portent une origine ou une date non renseignée' USING ERRCODE = 'P0001';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "events"."events" DROP CONSTRAINT IF EXISTS "events_origin_check";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."events_origin_idx";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN IF EXISTS "origin";
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" DROP COLUMN IF EXISTS "date_known";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "done_date_known";
