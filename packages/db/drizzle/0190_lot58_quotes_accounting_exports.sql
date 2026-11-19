-- Lot 58 (FAC-11 ; D1 à D3 ; ADR 0097) : réglages des exports comptables (exercice, plan de comptes,
-- journaux) et exports demandés, en ajout seul (période, format, totaux rapprochés, contrôle). Schéma
-- quotes seulement. Ajout seul : compatible avec la version précédente du code (ARC-14).
CREATE TABLE "quotes"."accounting_export_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 1 NOT NULL,
	"accounts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"journals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "accounting_export_settings_month_check" CHECK ("quotes"."accounting_export_settings"."fiscal_year_start_month" between 1 and 12),
	CONSTRAINT "accounting_export_settings_json_check" CHECK (jsonb_typeof("quotes"."accounting_export_settings"."accounts") = 'object' and jsonb_typeof("quotes"."accounting_export_settings"."journals") = 'object')
);
--> statement-breakpoint
CREATE TABLE "quotes"."accounting_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"format" text NOT NULL,
	"period_kind" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" text NOT NULL,
	"invoiced_cents" bigint NOT NULL,
	"credited_cents" bigint NOT NULL,
	"received_cents" bigint NOT NULL,
	"document_count" integer NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "accounting_exports_format_check" CHECK ("quotes"."accounting_exports"."format" in ('receipts_journal', 'sales_journal', 'payments_journal', 'fec', 'originals')),
	CONSTRAINT "accounting_exports_period_check" CHECK ("quotes"."accounting_exports"."period_kind" in ('month', 'quarter', 'year', 'fiscal_year') and "quotes"."accounting_exports"."period_start" <= "quotes"."accounting_exports"."period_end"),
	CONSTRAINT "accounting_exports_status_check" CHECK ("quotes"."accounting_exports"."status" in ('done', 'blocked') and jsonb_typeof("quotes"."accounting_exports"."issues") = 'array')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_export_settings_organization_idx" ON "quotes"."accounting_export_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "accounting_exports_organization_idx" ON "quotes"."accounting_exports" USING btree ("organization_id");
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif et auteur des lignes. Les exports demandés sont en
-- ajout seul : ni modification ni suppression par le rôle applicatif.
--> statement-breakpoint
ALTER TABLE "quotes"."accounting_export_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."accounting_export_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."accounting_export_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."accounting_export_settings" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "accounting_export_settings_stamp" BEFORE INSERT OR UPDATE ON "quotes"."accounting_export_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "accounting_export_settings_journal_deletion" BEFORE DELETE ON "quotes"."accounting_export_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."accounting_exports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."accounting_exports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."accounting_exports"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT ON "quotes"."accounting_exports" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "accounting_exports_stamp" BEFORE INSERT OR UPDATE ON "quotes"."accounting_exports"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "accounting_exports_journal_deletion" BEFORE DELETE ON "quotes"."accounting_exports"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
