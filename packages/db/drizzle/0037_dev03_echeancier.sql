CREATE TABLE "quotes"."payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes"."payment_schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer,
	"percentage_basis_points" integer,
	"due_date" date NOT NULL,
	"paid_on" date,
	"payment_method_id" uuid,
	"paid_recorded_at" timestamp with time zone,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "payment_schedule_items_amount_xor_percentage" CHECK (("quotes"."payment_schedule_items"."amount_cents" is null) <> ("quotes"."payment_schedule_items"."percentage_basis_points" is null))
);
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "upcoming_horizon_days" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_version_id_quote_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "quotes"."quote_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."payment_schedule_items" ADD CONSTRAINT "payment_schedule_items_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "quotes"."payment_methods"("id") ON DELETE no action ON UPDATE no action;