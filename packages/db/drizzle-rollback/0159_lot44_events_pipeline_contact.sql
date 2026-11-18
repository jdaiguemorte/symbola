-- Annulation de 0159 (lot 44) : formulaire de contact, demandes reçues et pipeline disparaissent.
-- Refusée tant qu'une demande reçue existe (son message et sa période seraient perdus), tant qu'un
-- déplacement d'étape est au fil d'activité (le type énuméré est recréé sans la valeur) et tant qu'un
-- changement de statut n'a pas d'auteur (prospect créé par le formulaire : la colonne redevient
-- obligatoire). Les étapes et le réglage du formulaire, eux, se perdent : ce sont des réglages.
DO $$
DECLARE
  labels text;
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."prospect_requests") THEN
    RAISE EXCEPTION 'Annulation refusée : des demandes de contact existent encore (events.prospect_requests).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_activities" WHERE kind::text = 'stage_changed') THEN
    RAISE EXCEPTION 'Annulation refusée : des passages d''étape du pipeline sont au fil d''activité.';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_status_history" WHERE "changed_by_user_id" IS NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des changements de statut sans auteur existent (prospects du formulaire de contact).';
  END IF;
  SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'events' AND t.typname = 'event_activity_kind' AND e.enumlabel <> 'stage_changed';
  ALTER TYPE "events"."event_activity_kind" RENAME TO "event_activity_kind_rollback";
  EXECUTE format('CREATE TYPE "events"."event_activity_kind" AS ENUM (%s)', labels);
  ALTER TABLE "events"."event_activities" ALTER COLUMN kind TYPE "events"."event_activity_kind" USING kind::text::"events"."event_activity_kind";
  DROP TYPE "events"."event_activity_kind_rollback";
END $$;
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" ALTER COLUMN "changed_by_user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."events" DROP CONSTRAINT IF EXISTS "events_pipeline_stage_id_pipeline_stages_id_fk";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN IF EXISTS "pipeline_stage_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."prospect_requests";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."contact_forms";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."pipeline_stages";
