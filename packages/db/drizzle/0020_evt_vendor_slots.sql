CREATE TYPE "events"."vendor_slot_status" AS ENUM('to_find', 'quote_requested', 'quote_received', 'booked', 'not_required');--> statement-breakpoint
CREATE TABLE "events"."default_vendor_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events"."event_vendor_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"status" "events"."vendor_slot_status" DEFAULT 'to_find' NOT NULL,
	"vendor_name" text,
	"amount_cents" integer,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD CONSTRAINT "event_vendor_slots_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE no action ON UPDATE no action;