-- Annulation de 0129 (lot 33a, D6) : retour à un compte = une organisation, rôle et mot de passe
-- sur le compte. Refusée tant qu'un compte créé par le fournisseur d'identité n'a ni mot de passe
-- ni rôle, ou qu'un compte appartient à plusieurs organisations : l'ancien schéma ne saurait pas
-- les représenter. Les rôles et retraits d'accès reviennent des adhésions sur le compte.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."users" WHERE "password_hash" IS NULL OR ("role" IS NULL AND NOT "operator")) THEN
    RAISE EXCEPTION 'Annulation refusée : des comptes créés par le fournisseur d''identité n''ont ni mot de passe ni rôle.';
  END IF;
  IF EXISTS (SELECT 1 FROM "hub"."memberships" GROUP BY "user_id" HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Annulation refusée : des comptes appartiennent à plusieurs organisations.';
  END IF;
END $$;
--> statement-breakpoint
UPDATE "hub"."users" AS "u"
  SET "organization_id" = "m"."organization_id", "role" = "m"."role"::text::"hub"."role", "disabled_at" = coalesce("u"."disabled_at", "m"."disabled_at")
  FROM "hub"."memberships" AS "m" WHERE "m"."user_id" = "u"."id";
--> statement-breakpoint
UPDATE "hub"."users" SET "role" = 'admin', "organization_id" = NULL WHERE "operator";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "memberships_journal_deletion" ON "hub"."memberships";
--> statement-breakpoint
DROP TABLE "hub"."memberships";
--> statement-breakpoint
DROP TYPE "hub"."membership_role";
--> statement-breakpoint
ALTER TABLE "hub"."sessions" DROP COLUMN "organization_id";
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "idp_subject";
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN "operator";
--> statement-breakpoint
ALTER TABLE "hub"."users" ALTER COLUMN "role" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "hub"."users" ALTER COLUMN "password_hash" SET NOT NULL;
