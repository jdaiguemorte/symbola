-- Annulation de 0127 (lot 32a, D6) : valeur « vendor_reminded » des sortes d'activité (type recréé
-- sans elle). Refusée tant qu'une relance est inscrite (annuler d'abord 0128).
DO $$
DECLARE
  labels text;
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_activities" WHERE kind::text = 'vendor_reminded') THEN
    RAISE EXCEPTION 'Annulation refusée : des relances de prestataires sont inscrites dans l''activité.';
  END IF;
  SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'events' AND t.typname = 'event_activity_kind' AND e.enumlabel <> 'vendor_reminded';
  ALTER TYPE "events"."event_activity_kind" RENAME TO "event_activity_kind_rollback";
  EXECUTE format('CREATE TYPE "events"."event_activity_kind" AS ENUM (%s)', labels);
  ALTER TABLE "events"."event_activities" ALTER COLUMN kind TYPE "events"."event_activity_kind" USING kind::text::"events"."event_activity_kind";
  DROP TYPE "events"."event_activity_kind_rollback";
END $$;
