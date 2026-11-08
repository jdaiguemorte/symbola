CREATE TYPE "events"."event_type_audience" AS ENUM('couple', 'clients');--> statement-breakpoint
CREATE TABLE "events"."event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"audience" "events"."event_type_audience" DEFAULT 'clients' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"starter_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_types_organization_starter_key_unique" UNIQUE("organization_id","starter_key")
);
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "event_type_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."events" ADD CONSTRAINT "events_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "events"."event_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Lot 16 (ADR 0045) : types d'événement isolés par organisation (RLS forcée,
-- même policy que les autres tables du module events).
ALTER TABLE "events"."event_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events"."event_types" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_types"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_types" TO symbola_app;
