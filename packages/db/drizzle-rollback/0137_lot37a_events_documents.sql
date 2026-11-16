-- Annulation de 0137 (lot 37a) : dossiers, versions, partage et liens de partage des documents d'un
-- évènement. Chaque document garde son fichier courant (la dernière version) ; les versions
-- précédentes, les dossiers, les partages et les liens sont perdus (les fichiers des versions
-- précédentes restent dans le stockage, sans ligne). Refusée tant qu'une ouverture de lien est au fil
-- d'activité (le type énuméré est recréé sans la valeur).
DO $$
DECLARE
  labels text;
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_activities" WHERE kind::text = 'document_link_opened') THEN
    RAISE EXCEPTION 'Annulation refusée : des ouvertures de liens de partage sont au fil d''activité.';
  END IF;
  SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'events' AND t.typname = 'event_activity_kind' AND e.enumlabel <> 'document_link_opened';
  ALTER TYPE "events"."event_activity_kind" RENAME TO "event_activity_kind_rollback";
  EXECUTE format('CREATE TYPE "events"."event_activity_kind" AS ENUM (%s)', labels);
  ALTER TABLE "events"."event_activities" ALTER COLUMN kind TYPE "events"."event_activity_kind" USING kind::text::"events"."event_activity_kind";
  DROP TYPE "events"."event_activity_kind_rollback";
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."event_document_links";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."event_document_versions";
--> statement-breakpoint
ALTER TABLE "events"."event_documents" DROP CONSTRAINT IF EXISTS "event_documents_folder_id_event_document_folders_id_fk";
--> statement-breakpoint
ALTER TABLE "events"."event_documents" DROP COLUMN IF EXISTS "folder_id";
--> statement-breakpoint
ALTER TABLE "events"."event_documents" DROP COLUMN IF EXISTS "shared_with_clients";
--> statement-breakpoint
ALTER TABLE "events"."event_documents" DROP COLUMN IF EXISTS "shared_with_vendors";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."event_document_folders";
