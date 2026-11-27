-- Annulation de 0219 (lot 71a) : les imports oublient leur reprise, ce qu'ils n'avaient pas repris et
-- les noms des champs écrits (« D'où viennent ces valeurs ? » ne sait plus rien) ; le réglage de durée
-- de l'annuaire disparaît. Comme le prévoit la spécification (§ 4.1), les imports des sortes
-- « event_vendors » et « program » sont effacés du journal (leurs éléments, leurs traitements), puis le
-- type énuméré est recréé sans ces deux valeurs, PostgreSQL ne sachant pas en retirer une. Ce que ces
-- imports avaient écrit reste en place ; il ne se retire plus d'un geste.
DO $$
DECLARE
  labels text;
BEGIN
  DELETE FROM "hub"."import_items" WHERE import_id IN (SELECT id FROM "hub"."imports" WHERE entity_type::text IN ('event_vendors', 'program'));
  DELETE FROM "hub"."import_jobs" WHERE import_id IN (SELECT id FROM "hub"."imports" WHERE entity_type::text IN ('event_vendors', 'program'));
  DELETE FROM "hub"."imports" WHERE entity_type::text IN ('event_vendors', 'program');
  SELECT string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) INTO labels
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'hub' AND t.typname = 'import_entity_type' AND e.enumlabel NOT IN ('event_vendors', 'program');
  ALTER TYPE "hub"."import_entity_type" RENAME TO "import_entity_type_rollback";
  EXECUTE format('CREATE TYPE "hub"."import_entity_type" AS ENUM (%s)', labels);
  ALTER TABLE "hub"."imports" ALTER COLUMN entity_type TYPE "hub"."import_entity_type" USING entity_type::text::"hub"."import_entity_type";
  DROP TYPE "hub"."import_entity_type_rollback";
END $$;
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."imports_takeover_idx";
--> statement-breakpoint
ALTER TABLE "hub"."imports" DROP CONSTRAINT IF EXISTS "imports_takeover_id_takeovers_id_fk";
--> statement-breakpoint
ALTER TABLE "hub"."imports" DROP COLUMN IF EXISTS "takeover_id";
--> statement-breakpoint
ALTER TABLE "hub"."imports" DROP COLUMN IF EXISTS "leftovers";
--> statement-breakpoint
ALTER TABLE "hub"."import_items" DROP COLUMN IF EXISTS "fields";
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" DROP COLUMN IF EXISTS "import_leftovers_retention_days";
