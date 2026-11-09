-- Lot 19 (ADR 0048, RGPD-09) : durée de la preuve d'une demande d'exercice de
-- droits close, réglable par organisation (5 ans par défaut). À son terme, la
-- purge mensuelle propose d'anonymiser le nom de la personne.
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "request_proof_retention_months" integer DEFAULT 60 NOT NULL;
