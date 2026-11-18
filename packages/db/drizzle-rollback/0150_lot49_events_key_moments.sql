-- Annulation de 0150 (lot 49) : les temps forts et la rubrique « Invités » du portail disparaissent.
-- Refusée tant qu'un temps fort existe (les réponses des invités s'y rattachent). La rubrique
-- « Invités » est retirée des liens qui l'avaient : l'accès se ferme, rien d'autre ne change.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."key_moments") THEN
    RAISE EXCEPTION 'Annulation refusée : des temps forts existent encore (events.key_moments).';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "events"."event_links" SET "rubrics" = array_remove("rubrics", 'guests') WHERE 'guests' = ANY("rubrics");
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT IF EXISTS "event_links_rubrics_check";
--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_rubrics_check" CHECK ("events"."event_links"."rubrics" <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes']::text[]);
--> statement-breakpoint
DROP TABLE IF EXISTS "events"."key_moments";
