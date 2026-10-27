CREATE TYPE "events"."event_activity_kind" AS ENUM('task_done', 'task_undone');--> statement-breakpoint
CREATE TABLE "events"."event_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"kind" "events"."event_activity_kind" NOT NULL,
	"task_id" uuid,
	"task_label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events"."event_client_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"token_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_client_accesses_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "events"."event_activities" ADD CONSTRAINT "event_activities_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_activities" ADD CONSTRAINT "event_activities_task_id_event_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "events"."event_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_client_accesses" ADD CONSTRAINT "event_client_accesses_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE no action ON UPDATE no action;