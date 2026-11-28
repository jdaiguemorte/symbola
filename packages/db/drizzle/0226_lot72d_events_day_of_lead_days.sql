-- Lot 72d (EVT-02 ; J9 de la spécification du lot 72, tranchée le 27/11/2026) : combien de jours avant le
-- jour J « Ouvrir le Jour J » devient l'action de l'en-tête de la fiche, réglable par organisation (1 à 30) ;
-- sans ligne ou sans valeur, la valeur de départ (7, planning-health.json). Schéma events seulement, sans
-- étape de données ; colonne facultative, compatible avec l'image précédente (ARC-14).
ALTER TABLE "events"."planning_health_settings" ADD COLUMN "day_of_lead_days" integer;--> statement-breakpoint
ALTER TABLE "events"."planning_health_settings" ADD CONSTRAINT "planning_health_settings_day_of_lead_days_check" CHECK ("events"."planning_health_settings"."day_of_lead_days" is null or "events"."planning_health_settings"."day_of_lead_days" between 1 and 30);
