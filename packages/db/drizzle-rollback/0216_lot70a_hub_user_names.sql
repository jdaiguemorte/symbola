-- Annulation de 0216 (lot 70a) : prénom et nom des comptes disparaissent. Refusée tant qu'une personne en a
-- saisi un (elle le perdrait sans le savoir) : ils se vident d'abord, par la personne ou par l'exploitation.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."users" WHERE "first_name" IS NOT NULL OR "last_name" IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des comptes ont un prénom ou un nom (hub.users.first_name, last_name).';
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP CONSTRAINT IF EXISTS "users_last_name_check";
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP CONSTRAINT IF EXISTS "users_first_name_check";
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN IF EXISTS "last_name";
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN IF EXISTS "first_name";
