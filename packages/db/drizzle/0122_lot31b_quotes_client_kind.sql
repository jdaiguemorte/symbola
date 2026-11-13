-- Lot 31b (réponse 3 de l'avocat, décision D16) : troisième catégorie de client, le
-- non-professionnel (association, SCI…), à côté du consommateur et du professionnel. Seule dans
-- sa migration : une valeur ajoutée ne sert qu'après la validation de la transaction.
ALTER TYPE "quotes"."client_kind" ADD VALUE 'non_professional';
