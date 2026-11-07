ALTER TABLE "events"."event_clients" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "address_line" text;--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "wanted_budget_cents" integer;