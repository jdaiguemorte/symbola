-- Annulation de 0218 (lot 71a) : les pages de reprise disparaissent. Refusée tant qu'une reprise
-- existe : ses lignes disent quels fichiers ont été repris pour quel mariage.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."takeovers") THEN
    RAISE EXCEPTION 'annulation refusée : des reprises de mariage existent (hub.takeovers)' USING ERRCODE = 'P0001';
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."takeover_steps";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."takeovers";
