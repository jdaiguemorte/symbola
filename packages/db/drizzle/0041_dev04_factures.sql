CREATE TYPE "quotes"."client_kind" AS ENUM('individual', 'professional');--> statement-breakpoint
CREATE TYPE "quotes"."invoice_kind" AS ENUM('deposit', 'balance');--> statement-breakpoint
CREATE TABLE "quotes"."credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"number" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"issued_on" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"legal_mention" text,
	"seller_snapshot" jsonb NOT NULL,
	"buyer_snapshot" jsonb NOT NULL,
	"totals_snapshot" jsonb NOT NULL,
	CONSTRAINT "credit_notes_organization_id_number_unique" UNIQUE("organization_id","number")
);
--> statement-breakpoint
CREATE TABLE "quotes"."invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"schedule_item_id" uuid,
	"kind" "quotes"."invoice_kind" NOT NULL,
	"number" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"issued_on" date NOT NULL,
	"service_date" date,
	"payment_due_on" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"vat_regime" text NOT NULL,
	"legal_mention" text,
	"mentions" text,
	"seller_snapshot" jsonb NOT NULL,
	"buyer_snapshot" jsonb NOT NULL,
	"lines_snapshot" jsonb NOT NULL,
	"totals_snapshot" jsonb NOT NULL,
	CONSTRAINT "invoices_organization_id_number_unique" UNIQUE("organization_id","number")
);
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "invoice_payment_term_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "invoice_mentions" text;--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD COLUMN "client_kind" "quotes"."client_kind" DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "quotes"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ADD CONSTRAINT "invoices_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ADD CONSTRAINT "invoices_version_id_quote_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "quotes"."quote_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ADD CONSTRAINT "invoices_schedule_item_id_payment_schedule_items_id_fk" FOREIGN KEY ("schedule_item_id") REFERENCES "quotes"."payment_schedule_items"("id") ON DELETE no action ON UPDATE no action;