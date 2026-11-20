-- Lot 60 (L60-PLA-05, POR-10 ; accord de Julien du 18/11/2026) : rubrique « Plan de salle » des liens,
-- fermée par défaut comme les autres. Une contrainte élargie, rien d'autre dans le schéma events.
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_rubrics_check";--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_rubrics_check" CHECK ("events"."event_links"."rubrics" <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes', 'guests', 'questionnaires', 'floorplan']::text[]);