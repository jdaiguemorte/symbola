-- Annulation de 0246 (lot 74h) : la date et l'auteur d'une coupure disparaissent ; l'état « coupé » (enabled)
-- reste tel quel, l'image précédente ne lit pas ces colonnes.
ALTER TABLE "hub"."automations" DROP COLUMN IF EXISTS "paused_by";
--> statement-breakpoint
ALTER TABLE "hub"."automations" DROP COLUMN IF EXISTS "paused_at";
