CREATE TABLE "events"."program_item_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"program_item_id" uuid NOT NULL,
	"vendor_slot_id" uuid,
	"free_label" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events"."program_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"label" text NOT NULL,
	"location" text,
	"internal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events"."program_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time,
	"label" text NOT NULL,
	"location" text,
	"participant_labels" text[] DEFAULT '{}' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events"."program_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "program_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" ADD CONSTRAINT "program_item_participants_program_item_id_program_items_id_fk" FOREIGN KEY ("program_item_id") REFERENCES "events"."program_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" ADD CONSTRAINT "program_item_participants_vendor_slot_id_event_vendor_slots_id_fk" FOREIGN KEY ("vendor_slot_id") REFERENCES "events"."event_vendor_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."program_items" ADD CONSTRAINT "program_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."program_template_items" ADD CONSTRAINT "program_template_items_template_id_program_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "events"."program_templates"("id") ON DELETE cascade ON UPDATE no action;