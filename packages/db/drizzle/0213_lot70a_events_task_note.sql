-- Lot 70a (A7, « Oui, une note », 26/11/2026) : note interne d'une tâche, 2 000 caractères au plus, sans
-- caractère de contrôle (retours à la ligne et tabulations admis). Interne à l'agence : jamais lue par un
-- portail ni un lien. Schéma events seulement ; colonne facultative, compatible avec l'image précédente.
ALTER TABLE "events"."event_tasks" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD CONSTRAINT "event_tasks_note_check" CHECK ("events"."event_tasks"."note" is null or (char_length("events"."event_tasks"."note") between 1 and 2000 and "events"."event_tasks"."note" !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]'));