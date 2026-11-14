-- Annulation de 0132 (lot 34a) : retour aux statuts du PRD. Option redevient prospect, Clôturé
-- redevient réalisé, Annulé redevient perdu ; En préparation et Reporté redeviennent confirmé (la
-- date d'avant un report en cours est perdue, la nouvelle date reste). L'écart des tâches, les
-- tâches fixées, le fuseau et le rattachement des modèles aux types disparaissent.
ALTER TABLE "events"."task_templates" DROP CONSTRAINT "task_templates_event_type_id_event_types_id_fk";
--> statement-breakpoint
ALTER TABLE "events"."task_templates" DROP COLUMN "event_type_id";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN "fixed_at";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN "offset_days";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN "postponed_from_status";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN "postponed_from_date";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP CONSTRAINT "events_time_zone_check";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN "time_zone";
--> statement-breakpoint
ALTER TYPE "events"."event_status" RENAME TO "event_status_lot34a";
--> statement-breakpoint
CREATE TYPE "events"."event_status" AS ENUM('prospect', 'quote_sent', 'confirmed', 'done', 'lost');
--> statement-breakpoint
ALTER TABLE "events"."events" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "events"."events" ALTER COLUMN "status" SET DATA TYPE "events"."event_status" USING (CASE "status"::text WHEN 'option' THEN 'prospect' WHEN 'closed' THEN 'done' WHEN 'cancelled' THEN 'lost' WHEN 'in_preparation' THEN 'confirmed' WHEN 'postponed' THEN 'confirmed' ELSE "status"::text END)::"events"."event_status";
--> statement-breakpoint
ALTER TABLE "events"."events" ALTER COLUMN "status" SET DEFAULT 'prospect';
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" ALTER COLUMN "from_status" SET DATA TYPE "events"."event_status" USING (CASE "from_status"::text WHEN 'option' THEN 'prospect' WHEN 'closed' THEN 'done' WHEN 'cancelled' THEN 'lost' WHEN 'in_preparation' THEN 'confirmed' WHEN 'postponed' THEN 'confirmed' ELSE "from_status"::text END)::"events"."event_status";
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" ALTER COLUMN "to_status" SET DATA TYPE "events"."event_status" USING (CASE "to_status"::text WHEN 'option' THEN 'prospect' WHEN 'closed' THEN 'done' WHEN 'cancelled' THEN 'lost' WHEN 'in_preparation' THEN 'confirmed' WHEN 'postponed' THEN 'confirmed' ELSE "to_status"::text END)::"events"."event_status";
--> statement-breakpoint
DROP TYPE "events"."event_status_lot34a";
