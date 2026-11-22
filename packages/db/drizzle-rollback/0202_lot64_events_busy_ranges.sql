-- Annulation de 0202 (lot 64) : les règles des types, les réglages propres des évènements et les
-- réglages de l'organisation disparaissent ; les évènements reviennent à la journée entière.
-- Refusée tant qu'un réglage a été posé (il serait perdu sans que la planner le sache) : elle le note
-- et revient d'abord à la règle de départ (types, évènements), ou supprime ses réglages.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."events" WHERE "busy_start_day_offset" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des évènements ont une plage occupée propre (events.events.busy_start_day_offset).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_types" WHERE "busy_start_day_offset" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des types ont une plage occupée réglée (events.event_types.busy_start_day_offset).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."busy_settings") THEN
    RAISE EXCEPTION 'Annulation refusée : des réglages des plages occupées existent (events.busy_settings).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "events"."events" DROP CONSTRAINT IF EXISTS "events_busy_rule_check";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP CONSTRAINT IF EXISTS "events_busy_rule_complete_check";
--> statement-breakpoint
ALTER TABLE "events"."event_types" DROP CONSTRAINT IF EXISTS "event_types_busy_rule_check";
--> statement-breakpoint
ALTER TABLE "events"."event_types" DROP CONSTRAINT IF EXISTS "event_types_busy_rule_complete_check";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN IF EXISTS "busy_start_day_offset", DROP COLUMN IF EXISTS "busy_start_time", DROP COLUMN IF EXISTS "busy_end_day_offset", DROP COLUMN IF EXISTS "busy_end_time";
--> statement-breakpoint
ALTER TABLE "events"."event_types" DROP COLUMN IF EXISTS "busy_start_day_offset", DROP COLUMN IF EXISTS "busy_start_time", DROP COLUMN IF EXISTS "busy_end_day_offset", DROP COLUMN IF EXISTS "busy_end_time";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."busy_settings";
