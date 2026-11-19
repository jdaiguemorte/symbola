-- Lot 35b (HUB-13, décisions D6 et D7, ADR 0098) : reprises d'un export Symbola dans une organisation
-- vide (suivi du traitement de fond et bilan, sans donnée personnelle). Compatible avec l'image
-- précédente : une table nouvelle, qu'elle ignore.
CREATE TABLE "hub"."organization_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"archive_key" text,
	"archive_bytes" bigint DEFAULT 0 NOT NULL,
	"source_generated_at" timestamp with time zone,
	"report" jsonb,
	"error" text,
	"error_detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "organization_imports_status_check" CHECK ("hub"."organization_imports"."status" in ('pending', 'running', 'done', 'failed')),
	CONSTRAINT "organization_imports_error_check" CHECK ("hub"."organization_imports"."error" is null or "hub"."organization_imports"."error" in ('not_empty', 'unreadable', 'unknown_format', 'checksum', 'schema', 'file_refused', 'siren_mismatch', 'ledger_invalid', 'failed'))
);
--> statement-breakpoint
CREATE INDEX "organization_imports_organization_idx" ON "hub"."organization_imports" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_imports_active_idx" ON "hub"."organization_imports" USING btree ("organization_id") WHERE status in ('pending', 'running');

--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). Pas de
-- DELETE : la ligne reste comme trace une fois l'archive déposée effacée.
ALTER TABLE "hub"."organization_imports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."organization_imports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."organization_imports"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."organization_imports" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "organization_imports_stamp" BEFORE INSERT OR UPDATE ON "hub"."organization_imports"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "organization_imports_journal_deletion" BEFORE DELETE ON "hub"."organization_imports"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
