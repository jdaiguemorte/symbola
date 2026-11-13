-- Lot 31a (FAC-01, HUB-21, JUR-08 ; décisions D2, D3 et D5) : sections et options des
-- devis, choix des options par le client (daté, nominatif), modèles de devis par type
-- d'événement (sections, lignes, options, échéancier type), acompte ou arrhes.
CREATE TYPE "quotes"."advance_kind" AS ENUM('deposit', 'earnest');
--> statement-breakpoint
CREATE TABLE "quotes"."quote_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "quote_sections_title_check" CHECK (char_length("quotes"."quote_sections"."title") between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "quotes"."quote_sections" ADD CONSTRAINT "quote_sections_version_id_quote_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "quotes"."quote_versions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "quote_sections_organization_idx" ON "quotes"."quote_sections" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "quote_sections_version_idx" ON "quotes"."quote_sections" USING btree ("version_id");
--> statement-breakpoint
ALTER TABLE "quotes"."quote_sections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_sections" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."quote_sections"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."quote_sections" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "quote_sections_stamp" BEFORE INSERT OR UPDATE ON "quotes"."quote_sections"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "quote_sections_journal_deletion" BEFORE DELETE ON "quotes"."quote_sections"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
-- Une ligne appartient à une section (ou à aucune) ; une option reste hors du total tant
-- qu'elle n'est pas choisie.
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "section_id" uuid;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "is_option" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "option_chosen" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD CONSTRAINT "quote_lines_section_id_quote_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "quotes"."quote_sections"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Choix des options (qui, quand), modèle d'origine, acompte ou arrhes.
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "advance_kind" "quotes"."advance_kind";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "options_chosen_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "options_chosen_by" text;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "options_chosen_by_kind" text;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "template_id" uuid;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "template_version" integer;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD CONSTRAINT "quote_versions_options_chosen_check" CHECK (("quotes"."quote_versions"."options_chosen_at" is null and "quotes"."quote_versions"."options_chosen_by" is null and "quotes"."quote_versions"."options_chosen_by_kind" is null) or ("quotes"."quote_versions"."options_chosen_at" is not null and "quotes"."quote_versions"."options_chosen_by" is not null and "quotes"."quote_versions"."options_chosen_by_kind" is not null and char_length("quotes"."quote_versions"."options_chosen_by") between 1 and 200 and "quotes"."quote_versions"."options_chosen_by_kind" in ('client', 'planner')));
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "advance_kind_default" "quotes"."advance_kind";
--> statement-breakpoint
CREATE TABLE "quotes"."quote_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type_id" uuid,
	"name" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"global_discount_kind" "quotes"."global_discount_kind" DEFAULT 'none' NOT NULL,
	"global_discount_value" integer DEFAULT 0 NOT NULL,
	"advance_kind" "quotes"."advance_kind",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "quote_templates_name_check" CHECK (char_length("quotes"."quote_templates"."name") between 1 and 120),
	CONSTRAINT "quote_templates_version_check" CHECK ("quotes"."quote_templates"."version" >= 1)
);
--> statement-breakpoint
CREATE INDEX "quote_templates_organization_idx" ON "quotes"."quote_templates" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "quotes"."quote_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."quote_templates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."quote_templates" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "quote_templates_stamp" BEFORE INSERT OR UPDATE ON "quotes"."quote_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "quote_templates_journal_deletion" BEFORE DELETE ON "quotes"."quote_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD CONSTRAINT "quote_versions_template_id_quote_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "quotes"."quote_templates"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "quotes"."quote_template_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "quote_template_sections_title_check" CHECK (char_length("quotes"."quote_template_sections"."title") between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_sections" ADD CONSTRAINT "quote_template_sections_template_id_quote_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "quotes"."quote_templates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "quote_template_sections_organization_idx" ON "quotes"."quote_template_sections" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_sections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_sections" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."quote_template_sections"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."quote_template_sections" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "quote_template_sections_stamp" BEFORE INSERT OR UPDATE ON "quotes"."quote_template_sections"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "quote_template_sections_journal_deletion" BEFORE DELETE ON "quotes"."quote_template_sections"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TABLE "quotes"."quote_template_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"section_id" uuid,
	"catalog_item_id" uuid,
	"label" text NOT NULL,
	"description" text,
	"unit" text NOT NULL,
	"quantity_milli" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"vat_rate_basis_points" integer NOT NULL,
	"discount_basis_points" integer DEFAULT 0 NOT NULL,
	"is_option" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_lines" ADD CONSTRAINT "quote_template_lines_template_id_quote_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "quotes"."quote_templates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_lines" ADD CONSTRAINT "quote_template_lines_section_id_quote_template_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "quotes"."quote_template_sections"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_lines" ADD CONSTRAINT "quote_template_lines_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "quotes"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "quote_template_lines_organization_idx" ON "quotes"."quote_template_lines" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_lines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_lines" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."quote_template_lines"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."quote_template_lines" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "quote_template_lines_stamp" BEFORE INSERT OR UPDATE ON "quotes"."quote_template_lines"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "quote_template_lines_journal_deletion" BEFORE DELETE ON "quotes"."quote_template_lines"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TABLE "quotes"."quote_template_schedule_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer,
	"percentage_basis_points" integer,
	"due_rule" text NOT NULL,
	"days_before_event" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "quote_template_schedule_items_amount_xor_percentage" CHECK (("quotes"."quote_template_schedule_items"."amount_cents" is null) <> ("quotes"."quote_template_schedule_items"."percentage_basis_points" is null)),
	CONSTRAINT "quote_template_schedule_items_due_check" CHECK (("quotes"."quote_template_schedule_items"."due_rule" = 'at_signature' and "quotes"."quote_template_schedule_items"."days_before_event" is null) or ("quotes"."quote_template_schedule_items"."due_rule" = 'before_event' and "quotes"."quote_template_schedule_items"."days_before_event" between 0 and 1095))
);
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_schedule_items" ADD CONSTRAINT "quote_template_schedule_items_template_id_quote_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "quotes"."quote_templates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "quote_template_schedule_items_organization_idx" ON "quotes"."quote_template_schedule_items" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_schedule_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."quote_template_schedule_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."quote_template_schedule_items"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."quote_template_schedule_items" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "quote_template_schedule_items_stamp" BEFORE INSERT OR UPDATE ON "quotes"."quote_template_schedule_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "quote_template_schedule_items_journal_deletion" BEFORE DELETE ON "quotes"."quote_template_schedule_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
