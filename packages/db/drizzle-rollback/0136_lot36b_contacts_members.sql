-- Annulation de 0136 (lot 36b) : membres des foyers et entreprises, identifiants d'entreprise,
-- nature d'import « contacts ». Les liens entre contacts et les identifiants sont perdus ; refusée
-- tant qu'un import de contacts existe encore (le type énuméré est recréé sans la valeur).
DO $$
DECLARE
  labels text;
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."imports" WHERE entity_type::text = 'contacts') THEN
    RAISE EXCEPTION 'Annulation refusée : des imports de contacts existent encore.';
  END IF;
  SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'hub' AND t.typname = 'import_entity_type' AND e.enumlabel <> 'contacts';
  ALTER TYPE "hub"."import_entity_type" RENAME TO "import_entity_type_rollback";
  EXECUTE format('CREATE TYPE "hub"."import_entity_type" AS ENUM (%s)', labels);
  ALTER TABLE "hub"."imports" ALTER COLUMN entity_type TYPE "hub"."import_entity_type" USING entity_type::text::"hub"."import_entity_type";
  DROP TYPE "hub"."import_entity_type_rollback";
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "hub"."contact_members";
--> statement-breakpoint
ALTER TABLE "hub"."contacts" DROP CONSTRAINT IF EXISTS "contacts_company_ids_check";
--> statement-breakpoint
ALTER TABLE "hub"."contacts" DROP COLUMN IF EXISTS "company_id_number";
--> statement-breakpoint
ALTER TABLE "hub"."contacts" DROP COLUMN IF EXISTS "vat_number";
