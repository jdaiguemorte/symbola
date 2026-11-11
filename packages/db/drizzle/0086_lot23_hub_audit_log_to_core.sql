-- Lot 23 (ARC-16, ADR 0060) : les actions Admin de hub.audit_log passent dans
-- le journal commun core.audit_entries, puis l'ancienne table disparaît.
-- Exception assumée à la règle « une migration ne touche que son schéma »
-- (ADR 0060) : le journal commun est une brique de packages/db, comme
-- core.domain_events. Une action sur une organisation va dans son journal ;
-- les réglages de la plateforme restent sans organisation.
INSERT INTO "core"."audit_entries"
  ("organization_id", "occurred_at", "actor_kind", "actor_id", "action", "category", "object_type", "object_id")
SELECT
  "target_organization_id",
  "created_at",
  'admin',
  "admin_user_id",
  "action",
  CASE WHEN "action" = 'hub.platform_settings.updated' THEN 'administration' ELSE 'droits' END,
  CASE
    WHEN "target_user_id" IS NOT NULL THEN 'user'
    WHEN "target_organization_id" IS NOT NULL THEN 'organization'
  END,
  coalesce("target_user_id", "target_organization_id")
FROM "hub"."audit_log";
--> statement-breakpoint
DROP TABLE "hub"."audit_log" CASCADE;
