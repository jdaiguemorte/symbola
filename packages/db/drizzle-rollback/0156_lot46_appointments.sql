-- Annulation de 0156 (lot 46) : le module Rendez-vous disparaît avec son schéma. Refusée tant qu'un
-- rendez-vous réel (hors essai) existe : il serait perdu sans trace pour la planner ni pour la personne.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "appointments"."appointments" WHERE NOT "is_demo") THEN
    RAISE EXCEPTION 'annulation refusée : des rendez-vous existent dans appointments.appointments';
  END IF;
END
$$;
--> statement-breakpoint
DROP SCHEMA IF EXISTS "appointments" CASCADE;
