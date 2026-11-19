-- Annulation de 0191 (lot 60) : le module Plans de salle disparaît avec son schéma. Refusée tant
-- qu'un espace existe encore (configurations des lieux ou plans d'évènements : le savoir-faire de la
-- planner) ; supprimez-les d'abord depuis l'app, qui retire aussi les fonds de plan stockés. La
-- bibliothèque d'éléments, sans donnée propre à un lieu, part avec le schéma.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "floorplans"."spaces") THEN
    RAISE EXCEPTION 'Annulation refusée : des espaces de plans de salle existent encore (floorplans.spaces).';
  END IF;
END $$;
--> statement-breakpoint
DROP SCHEMA IF EXISTS "floorplans" CASCADE;
