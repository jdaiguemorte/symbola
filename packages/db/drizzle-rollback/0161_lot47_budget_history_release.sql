-- Annulation de 0161 (lot 47) : new_value_cents redevient obligatoire. Refusée tant qu'un engagé
-- libéré est à l'historique (une ligne sans nouvelle valeur serait perdue sans qu'on le sache).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "budget"."budget_line_history" WHERE "new_value_cents" IS NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des engagés libérés sont à l''historique du budget (budget.budget_line_history).';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_history" ALTER COLUMN "new_value_cents" SET NOT NULL;
