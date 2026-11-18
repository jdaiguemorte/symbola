-- Annulation de 0159 (lot 47) : briefs, scénarios, avis du client, feuilles de route, réglages et
-- colonnes de réponse des prestataires consultés. Les réponses, scénarios et feuilles de route sont
-- perdus. Refusée tant qu'une facture déposée par un prestataire existe (son document n'aurait plus
-- d'auteur) ou qu'une réponse, une facture ou une confirmation est au fil d'activité (le type
-- énuméré est recréé sans les trois valeurs).
DO $$
DECLARE
  labels text;
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_documents" WHERE "uploaded_by_user_id" IS NULL)
     OR EXISTS (SELECT 1 FROM "events"."event_document_versions" WHERE "uploaded_by_user_id" IS NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des factures ont été déposées par des prestataires (events.event_documents).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_activities" WHERE kind::text IN ('vendor_answered', 'vendor_invoice_received', 'vendor_roadmap_confirmed')) THEN
    RAISE EXCEPTION 'Annulation refusée : des réponses de prestataires sont au fil d''activité.';
  END IF;
  SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'events' AND t.typname = 'event_activity_kind'
      AND e.enumlabel NOT IN ('vendor_answered', 'vendor_invoice_received', 'vendor_roadmap_confirmed');
  ALTER TYPE "events"."event_activity_kind" RENAME TO "event_activity_kind_rollback";
  EXECUTE format('CREATE TYPE "events"."event_activity_kind" AS ENUM (%s)', labels);
  ALTER TABLE "events"."event_activities" ALTER COLUMN kind TYPE "events"."event_activity_kind" USING kind::text::"events"."event_activity_kind";
  DROP TYPE "events"."event_activity_kind_rollback";
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."vendor_coordination_settings";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."vendor_roadmaps";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."event_decision_option_feedback";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."vendor_scenario_choices";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."vendor_scenarios";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP CONSTRAINT IF EXISTS "event_vendor_candidates_brief_id_vendor_briefs_id_fk";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP CONSTRAINT IF EXISTS "event_vendor_candidates_invoice_document_id_event_documents_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_vendor_candidates_brief_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP CONSTRAINT IF EXISTS "event_vendor_candidates_availability_check";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP CONSTRAINT IF EXISTS "event_vendor_candidates_answer_message_check";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP CONSTRAINT IF EXISTS "event_vendor_candidates_dismissal_reason_check";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "brief_id";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "availability";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "answered_at";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "answer_message";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "reminded_at";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "dismissal_reason";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "invoice_document_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."vendor_brief_documents";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."vendor_briefs";
--> statement-breakpoint
ALTER TABLE "events"."event_decisions" DROP COLUMN IF EXISTS "engaged_at";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_tasks_follow_up_candidate_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP CONSTRAINT IF EXISTS "event_tasks_follow_up_candidate_id_event_vendor_candidates_id_fk";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "follow_up_candidate_id";
--> statement-breakpoint
ALTER TABLE "events"."event_documents" DROP CONSTRAINT IF EXISTS "event_documents_uploaded_by_link_id_event_links_id_fk";
--> statement-breakpoint
ALTER TABLE "events"."event_documents" DROP COLUMN IF EXISTS "uploaded_by_link_id";
--> statement-breakpoint
ALTER TABLE "events"."event_documents" ALTER COLUMN "uploaded_by_user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_document_versions" ALTER COLUMN "uploaded_by_user_id" SET NOT NULL;
