-- Annulation de 0122 (lot 31b, D16) : valeur « non_professional » du type des clients (type
-- recréé sans elle). Refusée tant qu'un devis l'utilise.
DO $$
DECLARE
  labels text;
BEGIN
  IF EXISTS (SELECT 1 FROM "quotes"."quotes" WHERE client_kind::text = 'non_professional') THEN
    RAISE EXCEPTION 'Annulation refusée : des devis ont un client non-professionnel.';
  END IF;
  SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'quotes' AND t.typname = 'client_kind' AND e.enumlabel <> 'non_professional';
  ALTER TYPE "quotes"."client_kind" RENAME TO "client_kind_rollback";
  EXECUTE format('CREATE TYPE "quotes"."client_kind" AS ENUM (%s)', labels);
  ALTER TABLE "quotes"."quotes" ALTER COLUMN client_kind DROP DEFAULT;
  ALTER TABLE "quotes"."quotes" ALTER COLUMN client_kind TYPE "quotes"."client_kind" USING client_kind::text::"quotes"."client_kind";
  ALTER TABLE "quotes"."quotes" ALTER COLUMN client_kind SET DEFAULT 'individual';
  DROP TYPE "quotes"."client_kind_rollback";
END $$;
