-- Lot 64 (RDV-01 ; D8 ; ADR 0109) : quelques mots sur un type de rendez-vous, affichés sur la page de
-- réservation à côté du calendrier (300 caractères au plus). Schéma appointments seulement. Ajout
-- seul : compatible avec la version précédente du code (ARC-14).
ALTER TABLE "appointments"."appointment_types" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "appointments"."appointment_types" ADD CONSTRAINT "appointment_types_description_check" CHECK ("appointments"."appointment_types"."description" is null or char_length("appointments"."appointment_types"."description") between 1 and 300);
