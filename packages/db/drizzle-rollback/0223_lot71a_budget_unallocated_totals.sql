-- Annulation de 0223 (lot 71a) : les totaux « à répartir » des mariages repris disparaissent. Refusée
-- tant qu'il en reste un : ce montant n'existe nulle part ailleurs (la fiche PDF n'est pas gardée).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "budget"."unallocated_totals") THEN
    RAISE EXCEPTION 'annulation refusée : des totaux à répartir de mariages repris existent (budget.unallocated_totals)' USING ERRCODE = 'P0001';
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "budget"."unallocated_totals";
