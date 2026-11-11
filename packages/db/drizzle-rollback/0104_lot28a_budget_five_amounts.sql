-- Annulation de 0104 (lot 28a, BUD-01, BUD-02) : retour au prévu et au réel. Le
-- devisé et le payé sont perdus, comme l'historique de ces deux montants ; les
-- seuils d'alerte aussi.
DROP TABLE "budget"."alert_thresholds";
--> statement-breakpoint
DELETE FROM "budget"."budget_line_history" WHERE "field"::text IN ('quoted', 'paid');
--> statement-breakpoint
ALTER TYPE "budget"."budget_line_field" RENAME TO "budget_line_field_rollback";
--> statement-breakpoint
CREATE TYPE "budget"."budget_line_field" AS ENUM('planned', 'actual');
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_history" ALTER COLUMN "field" TYPE "budget"."budget_line_field"
  USING (CASE "field"::text WHEN 'estimated' THEN 'planned' ELSE 'actual' END)::"budget"."budget_line_field";
--> statement-breakpoint
DROP TYPE "budget"."budget_line_field_rollback";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" DROP COLUMN "paid_amount_cents";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" DROP COLUMN "quoted_amount_cents";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" RENAME COLUMN "committed_amount_cents" TO "actual_amount_cents";
--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" RENAME COLUMN "estimated_amount_cents" TO "planned_amount_cents";
