-- Annulation de 0153 (lot 49) : le module Invités disparaît avec son schéma. Refusée tant qu'un
-- foyer, un régime ou une preuve d'accord existe encore : ce sont des données de personnes (purgez
-- ou effacez-les d'abord, RGP-08). Les réglages, la liste des régimes et les traces d'import sans
-- donnée personnelle partent avec le schéma.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "guests"."households") THEN
    RAISE EXCEPTION 'Annulation refusée : des foyers d''invités existent encore (guests.households).';
  END IF;
  IF EXISTS (SELECT 1 FROM "guests"."diet_consents") THEN
    RAISE EXCEPTION 'Annulation refusée : des preuves d''accord existent encore (guests.diet_consents).';
  END IF;
END $$;
--> statement-breakpoint
DROP SCHEMA IF EXISTS "guests" CASCADE;
