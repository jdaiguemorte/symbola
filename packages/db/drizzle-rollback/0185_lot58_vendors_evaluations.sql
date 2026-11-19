-- Annulation de 0185 (lot 58) : les évaluations des prestataires disparaissent. Refusée tant qu'une
-- évaluation existe (l'historique des collaborations serait perdu).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "vendors"."vendor_evaluations") THEN
    RAISE EXCEPTION 'Annulation refusée : des évaluations de prestataires existent (vendors.vendor_evaluations).';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "vendors"."vendor_evaluations";
