-- Lot 40b (ARC-10 ; D9 ; ADR 0076) : file des tâches de fond d'une organisation (e-mails à envoyer,
-- tentés aussitôt puis repris). La clé d'unicité empêche le double envoi ; le contenu s'efface dès
-- la fin de la tâche. Schéma hub seulement ; table nouvelle, technique (ni auteur ni journal).
-- Ajout seul : compatible avec la version précédente du code (ARC-14).
CREATE TABLE "hub"."jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "jobs_kind_check" CHECK ("hub"."jobs"."kind" in ('email')),
	CONSTRAINT "jobs_state_check" CHECK ("hub"."jobs"."state" in ('pending', 'running', 'done', 'failed', 'interrupted')),
	CONSTRAINT "jobs_key_check" CHECK (length("hub"."jobs"."idempotency_key") between 1 and 200),
	CONSTRAINT "jobs_attempts_check" CHECK ("hub"."jobs"."attempts" between 0 and 20),
	CONSTRAINT "jobs_last_error_check" CHECK ("hub"."jobs"."last_error" is null or length("hub"."jobs"."last_error") <= 200),
	CONSTRAINT "jobs_payload_check" CHECK (("hub"."jobs"."state" in ('pending', 'running')) = ("hub"."jobs"."payload" is not null)),
	CONSTRAINT "jobs_payload_size_check" CHECK ("hub"."jobs"."payload" is null or pg_column_size("hub"."jobs"."payload") <= 33554432)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_organization_key_idx" ON "hub"."jobs" USING btree ("organization_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "jobs_organization_idx" ON "hub"."jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "jobs_due_idx" ON "hub"."jobs" USING btree ("state","run_after");

--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "hub"."jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."jobs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."jobs"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."jobs" TO symbola_app;
