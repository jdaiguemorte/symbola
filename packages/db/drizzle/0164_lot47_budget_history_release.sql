-- Lot 47 (PAR-05, D6 ; ADR 0085 ; accord de Julien du 18/11/2026, option a) : quand la planner ne
-- retient plus un prestataire, le module Budget libère l'engagé de ses lignes (événement
-- events.vendor_retention.released) ; l'historique des montants garde ce passage à « vide ». Seule
-- modification : new_value_cents devient facultative. Compatible avec l'image précédente (ARC-14).
ALTER TABLE "budget"."budget_line_history" ALTER COLUMN "new_value_cents" DROP NOT NULL;
