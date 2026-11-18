-- Annulation de 0166 (lot 43) : les payeurs, leurs parts et les payeurs désignés des échéances sont
-- perdus ; le budget redevient celui des mariés seuls. Les échéances et les lignes restent.
DROP TABLE "budget"."planner_instalment_payers";
--> statement-breakpoint
DROP TABLE "budget"."budget_line_payer_shares";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP CONSTRAINT "vendor_payments_payer_id_event_payers_id_fk";
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" DROP COLUMN "payer_id";
--> statement-breakpoint
DROP TABLE "budget"."event_payers";
