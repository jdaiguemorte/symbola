CREATE TYPE "budget"."budget_line_field" AS ENUM('planned', 'actual');--> statement-breakpoint
CREATE TABLE "budget"."budget_line_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"field" "budget"."budget_line_field" NOT NULL,
	"old_value_cents" integer,
	"new_value_cents" integer NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget"."budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"event_vendor_slot_id" uuid NOT NULL,
	"planned_amount_cents" integer NOT NULL,
	"actual_amount_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "budget_lines_event_vendor_slot_id_unique" UNIQUE("event_vendor_slot_id")
);
--> statement-breakpoint
ALTER TABLE "budget"."budget_line_history" ADD CONSTRAINT "budget_line_history_line_id_budget_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "budget"."budget_lines"("id") ON DELETE no action ON UPDATE no action;