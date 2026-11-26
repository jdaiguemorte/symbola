-- Lot 70a (UX-06, CHR-05 ; M10) : seuil de « Bientôt » d'une tâche, réglable par organisation (1 à 30
-- jours) ; sans ligne ou sans valeur, la valeur de départ (7, planning-health.json). Schéma events seulement ;
-- colonne facultative, compatible avec l'image précédente.
ALTER TABLE "events"."planning_health_settings" ADD COLUMN "soon_days" integer;--> statement-breakpoint
ALTER TABLE "events"."planning_health_settings" ADD CONSTRAINT "planning_health_settings_soon_days_check" CHECK ("events"."planning_health_settings"."soon_days" is null or "events"."planning_health_settings"."soon_days" between 1 and 30);