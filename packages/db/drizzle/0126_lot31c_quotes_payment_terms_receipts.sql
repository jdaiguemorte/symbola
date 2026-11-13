-- Lot 31c (réponses 1 et 7 bis de l'expert-comptable ; décisions D18 et D21) : conditions de
-- paiement face à un professionnel et taux des pénalités de retard choisi par la planner (sans
-- valeur par défaut) ; préfixe et table des reçus d'arrhes, non fiscaux, immuables comme les
-- factures (seul un reçu d'essai se supprime ; seule la copie des clients s'anonymise à la fin de
-- la conservation, comme pour les factures : migration 0057).
CREATE TABLE "quotes"."earnest_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"schedule_item_id" uuid NOT NULL,
	"payment_entry_id" uuid NOT NULL,
	"number" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"issued_on" date NOT NULL,
	"paid_on" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"label" text NOT NULL,
	"payment_method_label" text,
	"seller_snapshot" jsonb NOT NULL,
	"buyer_snapshot" jsonb NOT NULL,
	"created_by" uuid,
	CONSTRAINT "earnest_receipts_payment_entry_id_unique" UNIQUE("payment_entry_id"),
	CONSTRAINT "earnest_receipts_organization_id_number_unique" UNIQUE("organization_id","number")
);
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "invoice_mentions_professional" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "late_penalty_rate" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "receipt_prefix" text DEFAULT 'R' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."earnest_receipts" ADD CONSTRAINT "earnest_receipts_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."earnest_receipts" ADD CONSTRAINT "earnest_receipts_schedule_item_id_payment_schedule_items_id_fk" FOREIGN KEY ("schedule_item_id") REFERENCES "quotes"."payment_schedule_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."earnest_receipts" ADD CONSTRAINT "earnest_receipts_payment_entry_id_payment_entries_id_fk" FOREIGN KEY ("payment_entry_id") REFERENCES "quotes"."payment_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "earnest_receipts_organization_idx" ON "quotes"."earnest_receipts" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD CONSTRAINT "quote_settings_late_penalty_rate_check" CHECK ("quotes"."quote_settings"."late_penalty_rate" is null or "quotes"."quote_settings"."late_penalty_rate" in ('ecb_plus_10', 'three_times_legal'));
--> statement-breakpoint
ALTER TABLE "quotes"."earnest_receipts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."earnest_receipts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."earnest_receipts"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "quotes"."earnest_receipts" TO symbola_app;
--> statement-breakpoint
GRANT UPDATE ("buyer_snapshot") ON "quotes"."earnest_receipts" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER earnest_receipts_immutable BEFORE UPDATE OR DELETE ON "quotes"."earnest_receipts"
  FOR EACH ROW EXECUTE FUNCTION "quotes"."forbid_issued_document_change"();
--> statement-breakpoint
CREATE TRIGGER "earnest_receipts_stamp" BEFORE INSERT OR UPDATE ON "quotes"."earnest_receipts"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "earnest_receipts_journal_deletion" BEFORE DELETE ON "quotes"."earnest_receipts"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();