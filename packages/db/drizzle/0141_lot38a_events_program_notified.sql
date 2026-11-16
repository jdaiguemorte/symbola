-- Lot 38a (D9 ; ADR 0072) : l'envoi par e-mail d'une version diffusée du programme (date, nombre de
-- destinataires). Le contenu d'une version reste figé : le rôle de l'app ne peut modifier que ces
-- deux colonnes. Schéma events seulement ; colonnes nouvelles et facultatives.
ALTER TABLE "events"."program_versions" ADD COLUMN "notified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."program_versions" ADD COLUMN "notified_count" integer;
--> statement-breakpoint
GRANT UPDATE ("notified_at", "notified_count") ON "events"."program_versions" TO symbola_app;
