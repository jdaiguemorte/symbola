-- Annulation de 0151 (lot 49) : les durées de la purge des invités disparaissent des réglages RGPD
-- (la purge reprendrait les valeurs de départ si le code du lot restait en place).
ALTER TABLE "hub"."privacy_settings" DROP COLUMN IF EXISTS "guest_retention_days";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" DROP COLUMN IF EXISTS "guest_diet_retention_days";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" DROP COLUMN IF EXISTS "guest_purge_max_postpone_days";
