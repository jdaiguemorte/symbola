-- Annulation de 0181 (lot 53) : les notifications, les abonnements push, les réglages des personnes,
-- les automatismes, leur journal et les règles du radar disparaissent. Rien de métier n'y vit : les
-- réglages reviennent aux valeurs de départ, les notifications et le journal sont des traces de 90 jours,
-- les appareils se réabonnent. Les automatismes coupés repartiraient actifs : l'annulation est refusée
-- tant qu'un automatisme est coupé (la planner le remet en route, ou accepte de le retrouver actif en le
-- notant avant l'annulation).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."automations" WHERE "enabled" = false) THEN
    RAISE EXCEPTION 'Annulation refusée : des automatismes sont coupés (hub.automations) ; ils repartiraient actifs.';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."risk_rules";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."automation_runs";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."automations";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."push_subscriptions";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."notifications";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."notification_preferences";
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."notification_settings";
