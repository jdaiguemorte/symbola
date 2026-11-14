-- Annulation de 0131 (lot 33b) : le volume, les outils remplacés et le rôle des invitations
-- disparaissent. Refusée tant qu'une invitation de Planner attend d'être acceptée : sans son rôle,
-- elle deviendrait une invitation de Propriétaire.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."invitations" WHERE "role" = 'member' AND "accepted_at" IS NULL AND "expires_at" > now()) THEN
    RAISE EXCEPTION 'Annulation refusée : des invitations de Planner attendent encore d''être acceptées.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT "organization_profiles_replaced_tools_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP CONSTRAINT "organization_profiles_annual_event_volume_check";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "replaced_tools";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN "annual_event_volume";
--> statement-breakpoint
ALTER TABLE "hub"."invitations" DROP COLUMN "role";
