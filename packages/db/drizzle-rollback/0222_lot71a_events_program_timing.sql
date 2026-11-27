-- Annulation de 0222 (lot 71a) : la forme des moments disparaît. Refusée tant qu'un moment est
-- ponctuel ou un repère : l'image précédente le compterait comme une heure de fin manquante.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."program_items" WHERE timing <> 'span') THEN
    RAISE EXCEPTION 'annulation refusée : des moments du programme sont ponctuels ou des repères' USING ERRCODE = 'P0001';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "events"."program_items" DROP CONSTRAINT IF EXISTS "program_items_timing_check";
--> statement-breakpoint
ALTER TABLE "events"."program_items" DROP COLUMN IF EXISTS "timing";
