-- Lot 39a (DAT-03, UX-07 ; ADR 0073) : suppression logique dans le schéma budget (lignes et
-- paiements des prestataires) ; les pièces jointes et paiements d'une ligne supprimée sont cachés avec elle.
ALTER TABLE "budget"."budget_lines" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "budget"."budget_lines" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "budget"."vendor_payments" ADD COLUMN "deleted_by" uuid;
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "budget"."budget_lines" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "budget"."vendor_payments" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY line_visibility ON "budget"."vendor_payments" AS RESTRICTIVE
  USING (line_id IS NULL OR EXISTS (SELECT 1 FROM "budget"."budget_lines" p WHERE p.id = vendor_payments.line_id));
--> statement-breakpoint
CREATE POLICY line_visibility ON "budget"."budget_line_attachments" AS RESTRICTIVE
  USING (line_id IS NULL OR EXISTS (SELECT 1 FROM "budget"."budget_lines" p WHERE p.id = budget_line_attachments.line_id));
