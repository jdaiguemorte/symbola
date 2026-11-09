-- Lot 18 (ADR 0047) : dossier d'une demande RGPD (RGPD-07) — action menée à
-- la main et réponse envoyée, exigées pour clore — et nouvelle étape 4 « Vos
-- documents » de l'assistant de démarrage (AIDE-13) : les organisations dont
-- l'étape enregistrée est la 4e ou au-delà avancent d'un cran.
ALTER TABLE "hub"."privacy_requests" ADD COLUMN "action_done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."privacy_requests" ADD COLUMN "response_sent_at" timestamp with time zone;--> statement-breakpoint
UPDATE "hub"."organization_profiles" SET "setup_step" = "setup_step" + 1 WHERE "setup_step" >= 4;
