-- Annulation de 0194 (lot 55) : sujets, messages, pièces jointes, prestataires des sujets et
-- abonnements push des clients disparaissent ; la rubrique « Messages » sort des liens (la contrainte revient à la liste de main, migration 0192 du lot 60). Refusée tant
-- qu'un message existe (une conversation avec un client serait perdue) : la planner l'exporte avant.
-- Les fichiers des pièces jointes restent dans le stockage tant qu'un message existe : la règle le
-- garantit.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."messages") THEN
    RAISE EXCEPTION 'Annulation refusée : des messages existent (events.messages).';
  END IF;
END
$$;
--> statement-breakpoint
UPDATE "events"."event_links" SET "rubrics" = array_remove("rubrics", 'messages') WHERE 'messages' = ANY("rubrics");
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_rubrics_check";
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_rubrics_check" CHECK ("events"."event_links"."rubrics" <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes', 'guests', 'questionnaires', 'floorplan']::text[]);
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."link_push_subscriptions";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."message_attachments";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."messages";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."message_topic_links";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."message_topics";
