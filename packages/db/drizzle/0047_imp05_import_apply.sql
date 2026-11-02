CREATE TABLE "hub"."import_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"module" text NOT NULL,
	"kind" text NOT NULL,
	"element_id" uuid NOT NULL,
	"action" text NOT NULL,
	"previous" jsonb,
	"written" jsonb,
	"undo_outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "imported_fields" jsonb;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "imported_fields" jsonb;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "imported_fields" jsonb;--> statement-breakpoint
ALTER TABLE "hub"."imports" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."imports" ADD COLUMN "undone_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hub"."imports" ADD COLUMN "result" jsonb;--> statement-breakpoint
ALTER TABLE "quotes"."catalog_items" ADD COLUMN "imported_fields" jsonb;--> statement-breakpoint
ALTER TABLE "hub"."import_items" ADD CONSTRAINT "import_items_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "hub"."imports"("id") ON DELETE no action ON UPDATE no action;