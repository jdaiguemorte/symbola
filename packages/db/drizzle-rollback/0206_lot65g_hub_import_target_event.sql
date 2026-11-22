-- Annulation de 0206 (lot 65g) : les imports en cours oublient leur évènement de destination ; un
-- import inachevé lancé depuis un évènement devra désigner l'évènement par une colonne.
ALTER TABLE "hub"."imports" DROP COLUMN IF EXISTS "target_event_id";
