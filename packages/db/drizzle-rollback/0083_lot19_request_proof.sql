-- Annulation de 0083 (lot 19, ADR 0048) : le réglage « preuve des demandes »
-- disparaît (une durée modifiée par la titulaire est perdue). Les noms déjà
-- remplacés par « [anonymisé] » le restent : l'anonymisation est irréversible.
ALTER TABLE "hub"."privacy_settings" DROP COLUMN "request_proof_retention_months";
