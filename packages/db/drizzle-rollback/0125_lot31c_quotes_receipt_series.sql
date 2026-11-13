-- Annulation de 0125 (lot 31c, D21) : valeur « receipt » du type des séries de numérotation (type
-- recréé sans elle). Refusée tant qu'une série de reçus existe (annuler d'abord 0126).
DO $$
DECLARE
  labels text;
BEGIN
  IF EXISTS (SELECT 1 FROM "quotes"."number_series" WHERE kind::text = 'receipt') THEN
    RAISE EXCEPTION 'Annulation refusée : une série de reçus d''arrhes existe.';
  END IF;
  SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'quotes' AND t.typname = 'number_series_kind' AND e.enumlabel <> 'receipt';
  ALTER TYPE "quotes"."number_series_kind" RENAME TO "number_series_kind_rollback";
  EXECUTE format('CREATE TYPE "quotes"."number_series_kind" AS ENUM (%s)', labels);
  ALTER TABLE "quotes"."number_series" ALTER COLUMN kind TYPE "quotes"."number_series_kind" USING kind::text::"quotes"."number_series_kind";
  DROP TYPE "quotes"."number_series_kind_rollback";
END $$;
