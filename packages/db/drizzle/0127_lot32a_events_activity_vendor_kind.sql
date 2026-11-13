-- Lot 32a (PAR-03, SC-03 étape 5, décision D6) : sorte d'activité « prestataire relancé », inscrite
-- quand la planner relance depuis le cockpit un prestataire retenu sans contrat signé. Seule dans sa
-- migration : une valeur ajoutée ne sert qu'après la validation de la transaction.
ALTER TYPE "events"."event_activity_kind" ADD VALUE 'vendor_reminded';
