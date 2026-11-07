CREATE TYPE "hub"."backup_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "hub"."backup_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "hub"."backup_run_status" DEFAULT 'running' NOT NULL,
	"size_bytes" bigint
);
--> statement-breakpoint
-- Lecture seule pour le rôle applicatif (console Admin) ; seul le script de
-- sauvegarde écrit, avec le rôle d'administration (ADR 0033). Pas de RLS :
-- aucune donnée d'organisation, accès réservé à l'Admin par le code.
GRANT SELECT ON "hub"."backup_runs" TO symbola_app;
