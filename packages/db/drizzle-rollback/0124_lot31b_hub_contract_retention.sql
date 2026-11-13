-- Annulation de 0124 (lot 31b) : le défaut redevient 60 mois. Les organisations relevées à
-- 120 mois le restent (rien ne dit quelle valeur elles avaient).
ALTER TABLE "hub"."privacy_settings" ALTER COLUMN "signed_quote_retention_months" SET DEFAULT 60;
