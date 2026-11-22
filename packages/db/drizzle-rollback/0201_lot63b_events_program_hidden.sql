-- Annulation de 0201 (lot 63b) : la case « Cachée des mariés » disparaît. Refusée tant qu'une séquence
-- est cachée : elle redeviendrait visible des mariés sans que la planner le sache. Décochez d'abord.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."program_items" WHERE "hidden_from_clients") THEN
    RAISE EXCEPTION 'Annulation refusée : des séquences du programme sont cachées des mariés (events.program_items).';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "events"."program_items" DROP COLUMN "hidden_from_clients";
