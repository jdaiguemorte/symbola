CREATE TABLE "hub"."connection_traces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_entry_id" uuid NOT NULL,
	"ip" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "connection_trace_retention_months" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
CREATE INDEX "connection_traces_created_at_idx" ON "hub"."connection_traces" USING btree ("created_at");--> statement-breakpoint
-- Lot 23 (décision D5, ADR 0060) : le rôle applicatif écrit l'adresse IP d'une
-- connexion mais ne peut pas la relire. Il ne lit que created_at, pour la purge
-- (un DELETE … WHERE created_at < … demande ce droit de lecture). La table est
-- hors organisation, comme les comptes (pas de RLS).
GRANT INSERT, DELETE ON "hub"."connection_traces" TO symbola_app;
--> statement-breakpoint
GRANT SELECT ("created_at") ON "hub"."connection_traces" TO symbola_app;
