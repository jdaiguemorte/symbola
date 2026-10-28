CREATE TYPE "hub"."import_entity_type" AS ENUM('events', 'tasks', 'budget_lines', 'catalog_items', 'vendor_slots', 'prospect_sources', 'loss_reasons', 'payment_methods');--> statement-breakpoint
CREATE TYPE "hub"."import_status" AS ENUM('draft', 'applied', 'undone', 'cancelled');--> statement-breakpoint
CREATE TABLE "hub"."imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"entity_type" "hub"."import_entity_type" NOT NULL,
	"status" "hub"."import_status" DEFAULT 'draft' NOT NULL,
	"file_name" text NOT NULL,
	"file_format" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"encoding" text,
	"delimiter" text,
	"header_row_index" integer NOT NULL,
	"headers" jsonb NOT NULL,
	"rows" jsonb,
	"source_line_numbers" jsonb,
	"row_count" integer NOT NULL,
	"neutralized_cells" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "import_max_bytes" integer DEFAULT 10485760 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "import_max_rows" integer DEFAULT 5000 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "import_draft_retention_days" integer DEFAULT 7 NOT NULL;