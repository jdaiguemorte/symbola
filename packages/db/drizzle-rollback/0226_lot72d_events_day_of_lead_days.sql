-- Annulation de 0226 (lot 72d) : le réglage « Ouvrir le Jour J … jours avant » disparaît. Refusée tant
-- qu'une organisation en a réglé un (son choix serait perdu) ; sans réglage, l'en-tête reprend la valeur de
-- départ (7 jours).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."planning_health_settings" WHERE "day_of_lead_days" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : un délai « Ouvrir le Jour J » est réglé (events.planning_health_settings.day_of_lead_days).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "events"."planning_health_settings" DROP CONSTRAINT IF EXISTS "planning_health_settings_day_of_lead_days_check";
--> statement-breakpoint
ALTER TABLE "events"."planning_health_settings" DROP COLUMN IF EXISTS "day_of_lead_days";
