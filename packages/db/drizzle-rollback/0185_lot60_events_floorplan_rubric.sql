-- Annulation de 0185 (lot 60) : la rubrique « Plan de salle » disparaît. Refusée tant qu'un lien l'a
-- ouverte (un client y lit le plan) : fermez-la d'abord sur ses liens.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."event_links" WHERE 'floorplan' = ANY ("rubrics")) THEN
    RAISE EXCEPTION 'Annulation refusée : des liens ont la rubrique « Plan de salle » ouverte (events.event_links).';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_rubrics_check";
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_rubrics_check" CHECK ("events"."event_links"."rubrics" <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes', 'guests', 'questionnaires']::text[]);
