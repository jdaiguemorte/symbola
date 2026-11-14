-- Annulation de 0133 (lot 34b) : le lieu de réception redevient deux colonnes de l'événement,
-- reprises du premier lieu de la liste (son intitulé et sa ville) ; les lieux restent. Les
-- horaires et le contact des lieux, les invités, le style, les notes, les pièces jointes et les
-- commentaires des tâches sont perdus ; une tâche confiée à un prestataire revient à la planner.
-- Les fichiers des pièces jointes restent dans le stockage privé, sans ligne qui y mène : à
-- effacer à la main si l'annulation est définitive (docs/runbooks/restauration.md § 4 bis).
ALTER TABLE "events"."events" ADD COLUMN "venue_name" text;
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "venue_city" text;
--> statement-breakpoint
UPDATE "events"."events" AS e
SET "venue_name" = first."label", "venue_city" = first."city"
FROM (
  SELECT DISTINCT ON (p."event_id") p."event_id", p."label", p."city"
  FROM "events"."event_places" p
  ORDER BY p."event_id", p."position", p."created_at"
) AS first
WHERE first."event_id" = e."id";
--> statement-breakpoint
DROP TABLE "events"."event_task_comments";
--> statement-breakpoint
DROP TABLE "events"."event_task_attachments";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP CONSTRAINT "event_tasks_vendor_candidate_id_event_vendor_candidates_id_fk";
--> statement-breakpoint
DROP INDEX "events"."event_tasks_vendor_candidate_idx";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN "vendor_candidate_id";
--> statement-breakpoint
ALTER TYPE "events"."task_responsible" RENAME TO "task_responsible_lot34b";
--> statement-breakpoint
CREATE TYPE "events"."task_responsible" AS ENUM('planner', 'clients');
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ALTER COLUMN "responsible" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ALTER COLUMN "responsible" SET DATA TYPE "events"."task_responsible" USING (CASE "responsible"::text WHEN 'vendor' THEN 'planner' ELSE "responsible"::text END)::"events"."task_responsible";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ALTER COLUMN "responsible" SET DEFAULT 'planner';
--> statement-breakpoint
ALTER TABLE "events"."task_template_items" ALTER COLUMN "responsible" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "events"."task_template_items" ALTER COLUMN "responsible" SET DATA TYPE "events"."task_responsible" USING (CASE "responsible"::text WHEN 'vendor' THEN 'planner' ELSE "responsible"::text END)::"events"."task_responsible";
--> statement-breakpoint
ALTER TABLE "events"."task_template_items" ALTER COLUMN "responsible" SET DEFAULT 'planner';
--> statement-breakpoint
DROP TYPE "events"."task_responsible_lot34b";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP CONSTRAINT "events_identity_text_check";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP CONSTRAINT "events_guests_check";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN "notes";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN "style";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN "guests_confirmed";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN "guests_estimated";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP CONSTRAINT "event_places_details_check";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN "contact_email";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN "contact_phone";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN "contact_name";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN "end_time";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN "start_time";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN "city";
