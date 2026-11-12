-- Annulation de 0116 (lot 27b) : les décisions et leurs lignes du fil
-- d'activité sont perdues ; le type du fil revient à ses deux valeurs.
DELETE FROM "events"."event_activities" WHERE "kind" = 'decision_made';
--> statement-breakpoint
ALTER TYPE "events"."event_activity_kind" RENAME TO "event_activity_kind_lot27b";
--> statement-breakpoint
CREATE TYPE "events"."event_activity_kind" AS ENUM('task_done', 'task_undone');
--> statement-breakpoint
ALTER TABLE "events"."event_activities" ALTER COLUMN "kind" TYPE "events"."event_activity_kind" USING "kind"::text::"events"."event_activity_kind";
--> statement-breakpoint
DROP TYPE "events"."event_activity_kind_lot27b";
--> statement-breakpoint
DROP TABLE "events"."event_decisions";
--> statement-breakpoint
DROP FUNCTION "events"."guard_decision"();
