-- Annulation de 0196 (lot 63c) : le nom facultatif des évènements disparaît ; les évènements nommés
-- reprennent le nom tiré de leurs clients, ou celui de leur type.
ALTER TABLE "events"."events" DROP CONSTRAINT "events_name_check";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN "name";
