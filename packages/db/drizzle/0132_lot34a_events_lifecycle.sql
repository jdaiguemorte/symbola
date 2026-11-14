-- Lot 34a (EVT-05, EVT-01, CHR-01, DAT-07, ARC-17 ; ADR 0055 ; décisions D2 à D9) : cycle de vie
-- d'un événement. Statuts du cahier des charges, avec la correspondance de D2 pour les événements
-- et leur historique : prospect et devis envoyé deviennent Option, réalisé devient Clôturé, perdu
-- devient Annulé (motif gardé). « Jour J » n'est pas stocké. Chaque tâche garde son écart avec la
-- date de l'événement (DAT-07) ; un report garde la date et le statut d'avant ; un fuseau par
-- événement ; un modèle de rétroplanning peut être rattaché à un type.
ALTER TYPE "events"."event_status" RENAME TO "event_status_before_lot34a";
--> statement-breakpoint
CREATE TYPE "events"."event_status" AS ENUM('option', 'confirmed', 'in_preparation', 'closed', 'postponed', 'cancelled');
--> statement-breakpoint
ALTER TABLE "events"."events" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "events"."events" ALTER COLUMN "status" SET DATA TYPE "events"."event_status" USING (CASE "status"::text WHEN 'prospect' THEN 'option' WHEN 'quote_sent' THEN 'option' WHEN 'done' THEN 'closed' WHEN 'lost' THEN 'cancelled' ELSE "status"::text END)::"events"."event_status";
--> statement-breakpoint
ALTER TABLE "events"."events" ALTER COLUMN "status" SET DEFAULT 'option';
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" ALTER COLUMN "from_status" SET DATA TYPE "events"."event_status" USING (CASE "from_status"::text WHEN 'prospect' THEN 'option' WHEN 'quote_sent' THEN 'option' WHEN 'done' THEN 'closed' WHEN 'lost' THEN 'cancelled' ELSE "from_status"::text END)::"events"."event_status";
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" ALTER COLUMN "to_status" SET DATA TYPE "events"."event_status" USING (CASE "to_status"::text WHEN 'prospect' THEN 'option' WHEN 'quote_sent' THEN 'option' WHEN 'done' THEN 'closed' WHEN 'lost' THEN 'cancelled' ELSE "to_status"::text END)::"events"."event_status";
--> statement-breakpoint
DROP TYPE "events"."event_status_before_lot34a";
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "time_zone" text DEFAULT 'Europe/Paris' NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."events" ADD CONSTRAINT "events_time_zone_check" CHECK (char_length("events"."events"."time_zone") between 1 and 64);
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "postponed_from_date" date;
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "postponed_from_status" "events"."event_status";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "offset_days" integer;
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "fixed_at" timestamp with time zone;
--> statement-breakpoint
-- DAT-07 : l'écart des tâches existantes, depuis la date pour laquelle le rétroplanning a été
-- calculé (sinon la date de l'événement) ; une tâche d'un événement sans date reste sans écart.
UPDATE "events"."event_tasks" AS "t"
  SET "offset_days" = "t"."due_date" - coalesce("e"."tasks_scheduled_for", "e"."event_date")
  FROM "events"."events" AS "e"
  WHERE "e"."id" = "t"."event_id" AND coalesce("e"."tasks_scheduled_for", "e"."event_date") IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "events"."task_templates" ADD COLUMN "event_type_id" uuid;
--> statement-breakpoint
ALTER TABLE "events"."task_templates" ADD CONSTRAINT "task_templates_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "events"."event_types"("id") ON DELETE set null ON UPDATE no action;
