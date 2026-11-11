-- Annulation de 0086 (lot 23, ADR 0060) : recrée hub.audit_log (schéma de
-- 0009 et 0058, droits de 0010) et y recopie les actions de l'Admin du
-- journal commun. Les autres lignes du journal commun restent où elles sont.
CREATE TABLE "hub"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_organization_id" uuid,
	"target_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hub"."audit_log" ADD CONSTRAINT "audit_log_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "hub"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hub"."audit_log" ADD CONSTRAINT "audit_log_target_organization_id_organizations_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hub"."audit_log" ADD CONSTRAINT "audit_log_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "hub"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."audit_log" TO symbola_app;
--> statement-breakpoint
INSERT INTO "hub"."audit_log" ("admin_user_id", "action", "target_organization_id", "target_user_id", "created_at")
SELECT
  e."actor_id",
  e."action",
  e."organization_id",
  CASE WHEN e."object_type" = 'user' THEN e."object_id" END,
  e."occurred_at"
FROM "core"."audit_entries" e
WHERE e."actor_kind" = 'admin'
  AND e."actor_id" IN (SELECT "id" FROM "hub"."users")
  AND (e."organization_id" IS NULL OR e."organization_id" IN (SELECT "id" FROM "hub"."organizations"));
