-- Lot 31b (réponse 3 de l'avocat, décision D16) : un contrat électronique de 120 € et plus et son
-- dossier de preuve se conservent dix ans. La durée de conservation des devis signés passe à
-- 120 mois par défaut ; une organisation réglée en dessous est relevée à 120 mois.
ALTER TABLE "hub"."privacy_settings" ALTER COLUMN "signed_quote_retention_months" SET DEFAULT 120;
--> statement-breakpoint
UPDATE "hub"."privacy_settings" SET "signed_quote_retention_months" = 120 WHERE "signed_quote_retention_months" < 120;
