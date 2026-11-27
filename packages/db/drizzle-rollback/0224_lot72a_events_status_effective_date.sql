-- Annulation de 0224 (lot 72a) : la date effective des changements de statut disparaît. Les dates de
-- signature posées à la main sont perdues ; l'étape de la frise se lit alors au jour du clic.
ALTER TABLE "events"."event_status_history" DROP COLUMN IF EXISTS "effective_on";
