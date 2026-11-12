-- Annulation de 0115 (lot 27a) : les règlements déclarés en attente et les
-- motifs de refus sont perdus ; les échéances payées le restent (paid_on).
ALTER TABLE "budget"."vendor_payments" DROP CONSTRAINT "vendor_payments_declaration_check";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN "refused_at";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN "refusal_reason";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN "declared_at";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN "declared_by_link_id";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN "declared_method";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN "declared_paid_on";
