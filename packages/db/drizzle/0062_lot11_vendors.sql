CREATE SCHEMA "vendors";
--> statement-breakpoint
CREATE TYPE "events"."vendor_candidate_response" AS ENUM('contacted', 'quote_received', 'declined');--> statement-breakpoint
CREATE TYPE "vendors"."vendor_field_kind" AS ENUM('number', 'text', 'time', 'amount', 'choice', 'boolean');--> statement-breakpoint
CREATE TYPE "vendors"."vendor_file_kind" AS ENUM('brochure', 'rib');--> statement-breakpoint
CREATE TYPE "vendors"."vendor_location_source" AS ENUM('geocoded', 'manual');--> statement-breakpoint
CREATE TABLE "events"."event_vendor_candidate_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"body" text NOT NULL,
	"visible_to_clients" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events"."event_vendor_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"vendor_slot_id" uuid NOT NULL,
	"vendor_id" uuid,
	"vendor_name" text NOT NULL,
	"response" "events"."vendor_candidate_response" DEFAULT 'contacted' NOT NULL,
	"contacted_on" date,
	"quote_amount_cents" integer,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"quote_file_key" text,
	"quote_mime" text,
	"quote_size_bytes" integer,
	"shown_to_clients" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors"."vendor_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"kind" "vendors"."vendor_file_kind" NOT NULL,
	"file_name" text NOT NULL,
	"file_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors"."vendor_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"detour_factor_permille" integer DEFAULT 1300 NOT NULL,
	"average_speed_kmh" integer DEFAULT 60 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors"."vendor_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors"."vendor_type_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type_id" uuid NOT NULL,
	"label" text NOT NULL,
	"kind" "vendors"."vendor_field_kind" NOT NULL,
	"choices" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_filter" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors"."vendor_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors"."vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"type_id" uuid,
	"name" text NOT NULL,
	"contact_name" text,
	"email" text,
	"phone" text,
	"address_line" text,
	"postal_code" text,
	"city" text,
	"country" text DEFAULT 'FR' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"location_source" "vendors"."vendor_location_source",
	"internal_note" text,
	"field_values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tag_ids" uuid[] DEFAULT '{}' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "brief" text;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "selected_candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidate_notes" ADD CONSTRAINT "event_vendor_candidate_notes_candidate_id_event_vendor_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "events"."event_vendor_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD CONSTRAINT "event_vendor_candidates_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD CONSTRAINT "event_vendor_candidates_vendor_slot_id_event_vendor_slots_id_fk" FOREIGN KEY ("vendor_slot_id") REFERENCES "events"."event_vendor_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_files" ADD CONSTRAINT "vendor_files_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" ADD CONSTRAINT "vendor_type_fields_type_id_vendor_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "vendors"."vendor_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD CONSTRAINT "vendors_type_id_vendor_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "vendors"."vendor_types"("id") ON DELETE set null ON UPDATE no action;