-- Annulation de 0111 (lot 26a) : le type des rôles retrouve « client » ; les
-- comptes de mariés supprimés ne reviennent pas ; la mention d'information
-- personnalisée des pages à lien est perdue.
ALTER TYPE "hub"."role" RENAME TO "role_lot26a";
--> statement-breakpoint
CREATE TYPE "hub"."role" AS ENUM('owner', 'member', 'client', 'admin');
--> statement-breakpoint
ALTER TABLE "hub"."users" ALTER COLUMN "role" TYPE "hub"."role" USING "role"::text::"hub"."role";
--> statement-breakpoint
DROP TYPE "hub"."role_lot26a";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" DROP COLUMN "link_privacy_notice";
