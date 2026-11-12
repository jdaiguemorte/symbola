-- Annulation de 0114 (lot 27a) : la trace des rappels envoyés est perdue (le
-- lot 26 n'envoie pas de rappel) ; la case des rappels et la langue quittent les liens.
DROP TABLE "events"."event_task_reminders";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_locale_check";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP COLUMN "locale";
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP COLUMN "task_reminders";
