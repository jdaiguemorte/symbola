-- Lot 35a (HUB-13, DAT-13, ADR 0068) : exports complets de l'organisation (trace et suivi de la
-- préparation en arrière-plan) et durée de conservation de leur archive, réglée par l'Admin.
-- Compatible avec l'image du lot 34b : une table et une colonne nouvelles, qu'elle ignore.
CREATE TABLE "hub"."organization_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"files_total" integer DEFAULT 0 NOT NULL,
	"files_done" integer DEFAULT 0 NOT NULL,
	"missing_files" integer DEFAULT 0 NOT NULL,
	"size_bytes" bigint,
	"entity_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"archive_key" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "organization_exports_status_check" CHECK ("hub"."organization_exports"."status" in ('pending', 'running', 'ready', 'failed')),
	CONSTRAINT "organization_exports_error_check" CHECK ("hub"."organization_exports"."error" is null or "hub"."organization_exports"."error" in ('too_large', 'failed')),
	CONSTRAINT "organization_exports_files_check" CHECK ("hub"."organization_exports"."files_done" >= 0 and "hub"."organization_exports"."files_total" >= 0 and "hub"."organization_exports"."missing_files" >= 0)
);
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "organization_export_retention_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
CREATE INDEX "organization_exports_organization_idx" ON "hub"."organization_exports" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_exports_active_idx" ON "hub"."organization_exports" USING btree ("organization_id") WHERE status in ('pending', 'running');
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). Pas de
-- DELETE : la ligne reste comme trace une fois l'archive effacée.
ALTER TABLE "hub"."organization_exports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."organization_exports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."organization_exports"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."organization_exports" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "organization_exports_stamp" BEFORE INSERT OR UPDATE ON "hub"."organization_exports"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "organization_exports_journal_deletion" BEFORE DELETE ON "hub"."organization_exports"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
