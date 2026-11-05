ALTER TYPE "hub"."metier" ADD VALUE 'event_agency' BEFORE 'autre';--> statement-breakpoint
CREATE TABLE "events"."event_places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"address" text,
	"vendor_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events"."default_vendor_slots" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "share_rib_with_clients" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "setup_step" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "setup_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD CONSTRAINT "event_places_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;