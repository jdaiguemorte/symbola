-- Annulation de 0147 (lot 39a) : la suppression logique du schéma budget disparaît. Refusée tant
-- qu'une ligne est à la corbeille.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "budget"."budget_lines" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de budget.budget_lines sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "budget"."vendor_payments" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de budget.vendor_payments sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
END $$;
--> statement-breakpoint
DROP POLICY IF EXISTS line_visibility ON "budget"."vendor_payments";
--> statement-breakpoint
DROP POLICY IF EXISTS line_visibility ON "budget"."budget_line_attachments";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "budget"."budget_lines";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "budget"."vendor_payments";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN IF EXISTS "deleted_at";
