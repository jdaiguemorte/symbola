-- Annulation de 0214 (lot 70a) : le seuil de « Bientôt » disparaît. Refusée tant qu'une organisation en a
-- réglé un (son choix serait perdu) ; l'écran de réglage n'existant pas encore, c'est rare.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."planning_health_settings" WHERE "soon_days" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : un seuil « Bientôt » est réglé (events.planning_health_settings.soon_days).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "events"."planning_health_settings" DROP CONSTRAINT IF EXISTS "planning_health_settings_soon_days_check";
--> statement-breakpoint
ALTER TABLE "events"."planning_health_settings" DROP COLUMN IF EXISTS "soon_days";
