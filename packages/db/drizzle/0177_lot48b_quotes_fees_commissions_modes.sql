-- Lot 48b (BUD-08, PRE-07, JUR-10, DOC-02, HUB-26 ; D6 à D8 ; ADR 0093) : argent de la planner. Schéma
-- quotes seulement : honoraires par évènement (planner_fees), commissions et apports d'affaires
-- (vendor_commissions), mode « revendeur » ou « intermédiaire » et nature touristique de chaque ligne
-- de devis, nature des modèles de contrat (contrat, mandat, conditions générales, forfait
-- touristique), facture de commission adressée au prestataire (invoices.commission_id, sans devis).
-- Ajout seul (tables, colonnes avec valeur par défaut ou facultatives, contraintes ; quote_id et
-- version_id deviennent facultatifs pour la seule facture de commission) : compatible avec la version
-- précédente du code tant qu'aucune facture de commission n'est émise (ARC-14).
CREATE TABLE "quotes"."planner_fees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"flat_cents" integer,
	"percent_basis_points" integer,
	"base" text DEFAULT 'estimated' NOT NULL,
	"vat_rate_basis_points" integer DEFAULT 2000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "planner_fees_terms_check" CHECK ("quotes"."planner_fees"."kind" in ('flat', 'percent', 'mixed') and "quotes"."planner_fees"."base" in ('estimated', 'committed') and ("quotes"."planner_fees"."flat_cents" is null or "quotes"."planner_fees"."flat_cents" > 0) and ("quotes"."planner_fees"."percent_basis_points" is null or "quotes"."planner_fees"."percent_basis_points" between 1 and 10000) and (("quotes"."planner_fees"."kind" = 'flat') = ("quotes"."planner_fees"."percent_basis_points" is null)) and (("quotes"."planner_fees"."kind" = 'percent') = ("quotes"."planner_fees"."flat_cents" is null))),
	CONSTRAINT "planner_fees_vat_rate_check" CHECK ("quotes"."planner_fees"."vat_rate_basis_points" between 0 and 10000)
);
--> statement-breakpoint
CREATE TABLE "quotes"."vendor_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"vendor_id" uuid,
	"vendor_name" text NOT NULL,
	"nature" text DEFAULT 'commission' NOT NULL,
	"amount_cents" integer,
	"percent_basis_points" integer,
	"base_cents" integer,
	"vat_rate_basis_points" integer DEFAULT 2000 NOT NULL,
	"status" text DEFAULT 'expected' NOT NULL,
	"received_on" date,
	"shown_to_client" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_commissions_name_check" CHECK (char_length("quotes"."vendor_commissions"."vendor_name") between 1 and 200),
	CONSTRAINT "vendor_commissions_amount_check" CHECK (("quotes"."vendor_commissions"."amount_cents" is not null and "quotes"."vendor_commissions"."amount_cents" > 0 and "quotes"."vendor_commissions"."percent_basis_points" is null and "quotes"."vendor_commissions"."base_cents" is null) or ("quotes"."vendor_commissions"."amount_cents" is null and "quotes"."vendor_commissions"."percent_basis_points" between 1 and 10000 and "quotes"."vendor_commissions"."base_cents" is not null and "quotes"."vendor_commissions"."base_cents" > 0)),
	CONSTRAINT "vendor_commissions_status_check" CHECK ("quotes"."vendor_commissions"."nature" in ('commission', 'referral') and "quotes"."vendor_commissions"."status" in ('expected', 'invoiced', 'received') and (("quotes"."vendor_commissions"."status" = 'received') = ("quotes"."vendor_commissions"."received_on" is not null))),
	CONSTRAINT "vendor_commissions_vat_rate_check" CHECK ("quotes"."vendor_commissions"."vat_rate_basis_points" between 0 and 10000)
);
--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ALTER COLUMN "quote_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ALTER COLUMN "version_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."contract_templates" ADD COLUMN "kind" text DEFAULT 'contract' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ADD COLUMN "commission_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "supply_mode" text DEFAULT 'resale' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "tourism_kind" text;--> statement-breakpoint
CREATE INDEX "planner_fees_organization_idx" ON "quotes"."planner_fees" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "planner_fees_event_idx" ON "quotes"."planner_fees" USING btree ("organization_id","event_id");--> statement-breakpoint
CREATE INDEX "vendor_commissions_organization_idx" ON "quotes"."vendor_commissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_commissions_event_idx" ON "quotes"."vendor_commissions" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ADD CONSTRAINT "invoices_commission_id_vendor_commissions_id_fk" FOREIGN KEY ("commission_id") REFERENCES "quotes"."vendor_commissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_commission_idx" ON "quotes"."invoices" USING btree ("commission_id");--> statement-breakpoint
ALTER TABLE "quotes"."contract_templates" ADD CONSTRAINT "contract_templates_kind_check" CHECK ("quotes"."contract_templates"."kind" in ('contract', 'mandate', 'general_terms', 'package_travel'));--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ADD CONSTRAINT "invoices_subject_check" CHECK (("quotes"."invoices"."quote_id" is null) = ("quotes"."invoices"."version_id" is null) and ("quotes"."invoices"."quote_id" is null) = ("quotes"."invoices"."commission_id" is not null) and ("quotes"."invoices"."commission_id" is null or ("quotes"."invoices"."kind" = 'balance' and "quotes"."invoices"."schedule_item_id" is null)));--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD CONSTRAINT "quote_lines_supply_mode_check" CHECK ("quotes"."quote_lines"."supply_mode" in ('resale', 'intermediary'));--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD CONSTRAINT "quote_lines_tourism_kind_check" CHECK ("quotes"."quote_lines"."tourism_kind" is null or "quotes"."quote_lines"."tourism_kind" in ('transport', 'lodging', 'other'));
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées
-- (CLAUDE.md § 2.3, SEC-10, SEC-11, DAT-06, SEC-19).
--> statement-breakpoint
ALTER TABLE "quotes"."planner_fees" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."planner_fees" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."planner_fees"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."planner_fees" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "planner_fees_stamp" BEFORE INSERT OR UPDATE ON "quotes"."planner_fees"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "planner_fees_journal_deletion" BEFORE DELETE ON "quotes"."planner_fees"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."vendor_commissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."vendor_commissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."vendor_commissions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."vendor_commissions" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "vendor_commissions_stamp" BEFORE INSERT OR UPDATE ON "quotes"."vendor_commissions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_commissions_journal_deletion" BEFORE DELETE ON "quotes"."vendor_commissions"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
