-- Annulation de 0188 (lot 58) : clôtures, réglages de la clôture, modèles d'évènement et archivage
-- disparaissent. Refusée tant qu'une clôture, un modèle ou un évènement archivé existent (les leçons, le
-- temps passé, le budget figé ou un modèle seraient perdus ; un évènement archivé reviendrait dans les
-- listes courantes sans que la planner l'ait décidé) : la planner désarchive ou note ces données avant.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_closings") THEN
    RAISE EXCEPTION 'Annulation refusée : des clôtures d''évènement existent (events.event_closings).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_templates") THEN
    RAISE EXCEPTION 'Annulation refusée : des modèles d''évènement existent (events.event_templates).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."events" WHERE "archived_at" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des évènements sont archivés (events.events.archived_at).';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."event_templates";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."event_closings";
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."closing_settings";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN IF EXISTS "archived_by";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN IF EXISTS "archived_at";
