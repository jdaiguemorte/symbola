-- Lot 27a (SC-06 étape 5, POR-05, décision D6) : règlement d'une échéance
-- déclaré par un client depuis son lien (date, moyen, lien déclarant, date de
-- la déclaration), confirmé ou refusé par la planner ; motif du refus.
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "declared_paid_on" date;
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "declared_method" text;
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "declared_by_link_id" uuid;
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "declared_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "refusal_reason" text;
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "refused_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD CONSTRAINT "vendor_payments_declaration_check" CHECK (("budget"."vendor_payments"."declared_paid_on" is null and "budget"."vendor_payments"."declared_method" is null and "budget"."vendor_payments"."declared_by_link_id" is null and "budget"."vendor_payments"."declared_at" is null) or ("budget"."vendor_payments"."declared_paid_on" is not null and "budget"."vendor_payments"."declared_method" is not null and "budget"."vendor_payments"."declared_by_link_id" is not null and "budget"."vendor_payments"."declared_at" is not null));
