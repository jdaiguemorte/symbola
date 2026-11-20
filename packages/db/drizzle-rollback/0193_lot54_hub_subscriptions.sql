-- Annulation de 0193 (lot 54) : abonnements, catalogue, interrupteurs par fonction et quotas
-- disparaissent. Les modules ouverts par un abonnement restent dans hub.organization_modules (réglage
-- de l'Exploitation, comme avant le lot) ; aucune donnée métier n'est touchée. Refusée tant qu'une
-- organisation a un abonnement (son offre, ses dates d'essai et de résiliation seraient perdues).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."organization_subscriptions") THEN
    RAISE EXCEPTION 'annulation refusée : des organisations ont un abonnement';
  END IF;
END;
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."storage_quota_states";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."feature_flag_organizations";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."feature_flags";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."organization_subscriptions";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."plan_modules";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."plans";
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" DROP COLUMN IF EXISTS "subscription_rules";
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" DROP COLUMN IF EXISTS "subscription_billing_enabled";
