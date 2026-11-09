-- Annulation de 0082 (lot 18, ADR 0047) : les dates d'action et de réponse
-- des demandes RGPD sont perdues ; l'étape 4 « Vos documents » disparaît, les
-- organisations au-delà reculent d'un cran (celles à l'étape 4 reprennent au
-- budget, ancienne étape 4).
UPDATE "hub"."organization_profiles" SET "setup_step" = "setup_step" - 1 WHERE "setup_step" >= 5;
ALTER TABLE "hub"."privacy_requests" DROP COLUMN "response_sent_at";
ALTER TABLE "hub"."privacy_requests" DROP COLUMN "action_done_at";
