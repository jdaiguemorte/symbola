-- Annulation de 0109 (lot 26a) : les liens personnels, leurs catégories
-- partagées et leurs sessions sont perdus ; les coches faites par un lien
-- (sans compte pour auteur) sont supprimées du fil d'activité.
DELETE FROM "events"."event_activities" WHERE "actor_user_id" IS NULL;
--> statement-breakpoint
ALTER TABLE "events"."event_activities" DROP CONSTRAINT "event_activities_actor_link_id_event_links_id_fk";
--> statement-breakpoint
ALTER TABLE "events"."event_activities" DROP COLUMN "actor_link_id";
--> statement-breakpoint
ALTER TABLE "events"."event_activities" ALTER COLUMN "actor_user_id" SET NOT NULL;
--> statement-breakpoint
DROP TABLE "events"."event_link_sessions";
--> statement-breakpoint
DROP TABLE "events"."event_link_shared_slots";
--> statement-breakpoint
DROP TABLE "events"."event_links";
--> statement-breakpoint
DROP TYPE "events"."event_link_audience";
