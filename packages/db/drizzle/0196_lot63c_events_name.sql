-- Lot 63c (EVT-01 ; Q43, décision de Julien du 21/11/2026) : nom facultatif d'un évènement
-- (« Shooting Roux »), pour un évènement confirmé sans client. Schéma events seulement ; RLS de la
-- table inchangée. Ajout seul : compatible avec la version précédente du code (ARC-14).
ALTER TABLE "events"."events" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "events"."events" ADD CONSTRAINT "events_name_check" CHECK ("events"."events"."name" is null or char_length("events"."events"."name") between 1 and 200);