CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TABLE "core"."domain_event_consumers" (
	"consumer_name" text NOT NULL,
	"event_id" uuid NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domain_event_consumers_consumer_name_event_id_pk" PRIMARY KEY("consumer_name","event_id")
);
--> statement-breakpoint
CREATE TABLE "core"."domain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "core"."domain_event_consumers" ADD CONSTRAINT "domain_event_consumers_event_id_domain_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "core"."domain_events"("id") ON DELETE no action ON UPDATE no action;