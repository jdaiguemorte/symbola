-- Annulation de 0146 (lot 39a) : la suppression logique du schéma quotes disparaît. Refusée tant
-- qu'une ligne est à la corbeille.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "quotes"."quotes" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de quotes.quotes sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "quotes"."quote_lines" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de quotes.quote_lines sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "quotes"."quote_templates" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de quotes.quote_templates sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "quotes"."contract_templates" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de quotes.contract_templates sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
END $$;
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "quotes"."quotes";
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "quotes"."quote_lines";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "quotes"."quote_templates";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_templates" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_templates" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "quotes"."contract_templates";
--> statement-breakpoint
ALTER TABLE "quotes"."contract_templates" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "quotes"."contract_templates" DROP COLUMN IF EXISTS "deleted_at";
