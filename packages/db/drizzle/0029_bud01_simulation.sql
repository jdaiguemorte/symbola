-- Le schéma "budget" existe déjà (migration 0001, SOC-05) : CREATE SCHEMA
-- IF NOT EXISTS à la place de la ligne générée par drizzle-kit pour
-- rester rejouable.
CREATE SCHEMA IF NOT EXISTS "budget";
--> statement-breakpoint
CREATE TABLE "budget"."allocation_model_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"default_vendor_slot_id" uuid NOT NULL,
	"percentage_basis_points" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget"."allocation_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget"."event_budget_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_budget_id" uuid NOT NULL,
	"default_vendor_slot_id" uuid NOT NULL,
	"amount_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget"."event_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"guest_count" integer NOT NULL,
	"allocation_model_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_budgets_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
ALTER TABLE "budget"."allocation_model_items" ADD CONSTRAINT "allocation_model_items_model_id_allocation_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "budget"."allocation_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget"."event_budget_items" ADD CONSTRAINT "event_budget_items_event_budget_id_event_budgets_id_fk" FOREIGN KEY ("event_budget_id") REFERENCES "budget"."event_budgets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget"."event_budgets" ADD CONSTRAINT "event_budgets_allocation_model_id_allocation_models_id_fk" FOREIGN KEY ("allocation_model_id") REFERENCES "budget"."allocation_models"("id") ON DELETE no action ON UPDATE no action;