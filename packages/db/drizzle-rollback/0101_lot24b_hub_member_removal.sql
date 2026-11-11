-- Annulation de 0101 (lot 24b, SEC-06) : date de retrait des accès. Attention :
-- un compte dont l'accès avait été retiré redevient actif ; le vérifier avant d'annuler.
ALTER TABLE "hub"."users" DROP COLUMN IF EXISTS "disabled_at";
