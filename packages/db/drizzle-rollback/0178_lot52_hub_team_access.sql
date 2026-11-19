-- Annulation de 0178 (lot 52) : le rôle « accountant » disparaît du type ; les adhésions et les
-- invitations de comptable sont supprimées (un comptable ne devient jamais Planner), leurs sessions
-- fermées. Les appareils connus, les transferts de propriété en cours ou passés, les alertes de
-- changement d'identité, l'appareil et la dernière activité des sessions, le bandeau de double
-- authentification et le réglage de visibilité sont perdus : toutes les Planners voient de nouveau tout.
DELETE FROM "hub"."sessions" s USING "hub"."memberships" m
  WHERE m."user_id" = s."user_id" AND m."organization_id" = s."organization_id" AND m."role" = 'accountant';
--> statement-breakpoint
DELETE FROM "hub"."memberships" WHERE "role" = 'accountant';
--> statement-breakpoint
DELETE FROM "hub"."invitations" WHERE "role" = 'accountant';
--> statement-breakpoint
ALTER TYPE "hub"."membership_role" RENAME TO "membership_role_lot52";
--> statement-breakpoint
CREATE TYPE "hub"."membership_role" AS ENUM('owner', 'member');
--> statement-breakpoint
ALTER TABLE "hub"."memberships" ALTER COLUMN "role" SET DATA TYPE "hub"."membership_role" USING "role"::text::"hub"."membership_role";
--> statement-breakpoint
ALTER TABLE "hub"."invitations" ALTER COLUMN "role" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "hub"."invitations" ALTER COLUMN "role" SET DATA TYPE "hub"."membership_role" USING "role"::text::"hub"."membership_role";
--> statement-breakpoint
ALTER TABLE "hub"."invitations" ALTER COLUMN "role" SET DEFAULT 'owner';
--> statement-breakpoint
DROP TYPE "hub"."membership_role_lot52";
--> statement-breakpoint
DROP TABLE "hub"."identity_change_alerts";
--> statement-breakpoint
DROP TABLE "hub"."known_devices";
--> statement-breakpoint
DROP TABLE "hub"."ownership_transfers";
--> statement-breakpoint
DROP INDEX "hub"."sessions_user_idx";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP COLUMN "all_planners_see_all_events";
--> statement-breakpoint
ALTER TABLE "hub"."sessions" DROP COLUMN "device_label";
--> statement-breakpoint
ALTER TABLE "hub"."sessions" DROP COLUMN "device_id";
--> statement-breakpoint
ALTER TABLE "hub"."sessions" DROP COLUMN "last_seen_at";
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "mfa_prompt_dismissed_at";
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "mfa_factors_fingerprint";
