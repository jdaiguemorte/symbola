-- Annulation de 0149 (lot 40b) : la file des tâches de fond disparaît. Refusée tant qu'un e-mail
-- attend son envoi (à faire ou en cours) : il serait perdu. Les lignes terminées ne gardent que le
-- genre, l'état et les dates.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."jobs" WHERE "state" IN ('pending', 'running')) THEN
    RAISE EXCEPTION 'annulation refusée : des e-mails attendent encore leur envoi dans hub.jobs';
  END IF;
END
$$;
DROP TABLE IF EXISTS "hub"."jobs";
