-- Lot 31c (réponse 7 bis de l'expert-comptable, décision D21) : série à part des reçus d'arrhes,
-- non fiscaux, hors de la série des factures. Seule dans sa migration : une valeur ajoutée ne sert
-- qu'après la validation de la transaction.
ALTER TYPE "quotes"."number_series_kind" ADD VALUE 'receipt';
