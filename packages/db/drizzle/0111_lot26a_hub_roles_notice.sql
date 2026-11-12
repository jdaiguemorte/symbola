-- Lot 26a (RGP-03) : mention d'information des pages à lien personnel, au nom
-- de l'organisation, dans ses réglages RGPD ; vide, le texte de départ.
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "link_privacy_notice" text;
--> statement-breakpoint
-- Lot 26a (ADR 0053 § 9, décision D8) : les tiers n'ont plus de compte. Les
-- comptes « client » (mariés, ADR 0020) sont supprimés avec leurs sessions et
-- leurs traces ; il n'y en a que de fictifs (décision Q15). Les jetons de
-- réinitialisation, l'aide et les appareils de confiance suivent (cascade).
DELETE FROM "hub"."sessions" WHERE "user_id" IN (SELECT "id" FROM "hub"."users" WHERE "role" = 'client');
--> statement-breakpoint
DELETE FROM "hub"."user_tour_seen" WHERE "user_id" IN (SELECT "id" FROM "hub"."users" WHERE "role" = 'client');
--> statement-breakpoint
DELETE FROM "hub"."users" WHERE "role" = 'client';
--> statement-breakpoint
-- La valeur « client » quitte le type : il est recréé sans elle.
ALTER TYPE "hub"."role" RENAME TO "role_before_lot26a";
--> statement-breakpoint
CREATE TYPE "hub"."role" AS ENUM('owner', 'member', 'admin');
--> statement-breakpoint
ALTER TABLE "hub"."users" ALTER COLUMN "role" TYPE "hub"."role" USING "role"::text::"hub"."role";
--> statement-breakpoint
DROP TYPE "hub"."role_before_lot26a";
