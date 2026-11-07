-- Annulation de 0072 (lot 14c, DB-01) : valeur « event_sheets » du type
-- énuméré des imports et réglage du nombre de fiches. PostgreSQL ne sait pas
-- retirer une valeur d'un type énuméré : le type est recréé sans elle.
-- Refusée tant qu'un import l'utilise.
DO $$
DECLARE
  labels text;
BEGIN
  IF EXISTS (SELECT 1 FROM "hub"."imports" WHERE entity_type::text = 'event_sheets') THEN
    RAISE EXCEPTION 'Annulation refusée : des imports de fiches événement (event_sheets) existent encore.';
  END IF;
  SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'hub' AND t.typname = 'import_entity_type' AND e.enumlabel <> 'event_sheets';
  ALTER TYPE "hub"."import_entity_type" RENAME TO "import_entity_type_rollback";
  EXECUTE format('CREATE TYPE "hub"."import_entity_type" AS ENUM (%s)', labels);
  ALTER TABLE "hub"."imports" ALTER COLUMN entity_type TYPE "hub"."import_entity_type" USING entity_type::text::"hub"."import_entity_type";
  DROP TYPE "hub"."import_entity_type_rollback";
END $$;
ALTER TABLE "hub"."platform_settings" DROP COLUMN "import_max_sheets";
