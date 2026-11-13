-- Lot 31b (FAC-04, FAC-05, DOC-02, DOC-03, JUR-07, JUR-08, HUB-21 ; décisions D6, D7, D9, D11 à
-- D17, révisées après les réponses de l'avocat du 13/11/2026) : modèles de contrat à clauses et
-- variables, datés et versionnés, avertissement accepté ; contrats générés (figés, versionnés,
-- canal de conclusion, catégorie du client, régime de rétractation, niveau de signature) ; actes
-- des signataires (commande, exécution anticipée) ; dossier de preuve ; demande de signature du
-- devis suivi de son contrat, ou du contrat seul ; facture d'acompte à émettre d'elle-même ;
-- « acompte » proposé par défaut.
CREATE TYPE "quotes"."conclusion_channel" AS ENUM('on_premises', 'distance', 'off_premises', 'fair');--> statement-breakpoint
CREATE TYPE "quotes"."contract_clause_role" AS ENUM('precontractual_information', 'withdrawal_period', 'withdrawal_form', 'early_execution', 'termination', 'no_withdrawal', 'advance_deposit', 'advance_earnest');--> statement-breakpoint
CREATE TYPE "quotes"."signature_request_kind" AS ENUM('quote', 'quote_contract', 'contract');--> statement-breakpoint
CREATE TABLE "quotes"."contract_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"document_key" text NOT NULL,
	"sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contract_evidence_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "contract_evidence_sha256_check" CHECK ("quotes"."contract_evidence"."sha256" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "quotes"."contract_signer_acts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"contract_id" uuid NOT NULL,
	"signer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"signer_name" text NOT NULL,
	"presented_text" text NOT NULL,
	"acted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contract_signer_acts_contract_id_signer_id_kind_unique" UNIQUE("contract_id","signer_id","kind"),
	CONSTRAINT "contract_signer_acts_kind_check" CHECK ("quotes"."contract_signer_acts"."kind" in ('order', 'early_execution')),
	CONSTRAINT "contract_signer_acts_name_check" CHECK (char_length("quotes"."contract_signer_acts"."signer_name") between 1 and 200),
	CONSTRAINT "contract_signer_acts_text_check" CHECK (char_length("quotes"."contract_signer_acts"."presented_text") between 1 and 20000)
);
--> statement-breakpoint
CREATE TABLE "quotes"."contract_template_acceptances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"user_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contract_template_acceptances_template_id_template_version_user_id_unique" UNIQUE("template_id","template_version","user_id")
);
--> statement-breakpoint
CREATE TABLE "quotes"."contract_template_clauses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	"role" "quotes"."contract_clause_role",
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contract_template_clauses_title_check" CHECK (char_length("quotes"."contract_template_clauses"."title") between 1 and 200),
	CONSTRAINT "contract_template_clauses_body_check" CHECK (char_length("quotes"."contract_template_clauses"."body") <= 20000)
);
--> statement-breakpoint
CREATE TABLE "quotes"."contract_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type_id" uuid,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"legal_reviewed_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contract_templates_name_check" CHECK (char_length("quotes"."contract_templates"."name") between 1 and 120),
	CONSTRAINT "contract_templates_title_check" CHECK (char_length("quotes"."contract_templates"."title") between 1 and 200),
	CONSTRAINT "contract_templates_version_check" CHECK ("quotes"."contract_templates"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "quotes"."contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"quote_version_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"template_id" uuid,
	"template_version" integer NOT NULL,
	"template_reviewed_on" date,
	"title" text NOT NULL,
	"clauses" jsonb NOT NULL,
	"conclusion_channel" "quotes"."conclusion_channel" NOT NULL,
	"client_category" "quotes"."client_kind" NOT NULL,
	"small_business_confirmed" boolean DEFAULT false NOT NULL,
	"withdrawal_applies" boolean NOT NULL,
	"signature_level" text DEFAULT 'simple' NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contracts_quote_id_version_unique" UNIQUE("quote_id","version"),
	CONSTRAINT "contracts_version_check" CHECK ("quotes"."contracts"."version" >= 1),
	CONSTRAINT "contracts_title_check" CHECK (char_length("quotes"."contracts"."title") between 1 and 200),
	CONSTRAINT "contracts_signature_level_check" CHECK ("quotes"."contracts"."signature_level" in ('simple', 'advanced', 'qualified')),
	CONSTRAINT "contracts_channel_check" CHECK ("quotes"."contracts"."conclusion_channel" <> 'fair')
);
--> statement-breakpoint
CREATE TABLE "quotes"."scheduled_deposit_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"schedule_item_id" uuid NOT NULL,
	"issue_on" date NOT NULL,
	"payment_not_before" date,
	"status" text DEFAULT 'waiting' NOT NULL,
	"missing_fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"invoice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "scheduled_deposit_invoices_version_id_unique" UNIQUE("version_id"),
	CONSTRAINT "scheduled_deposit_invoices_status_check" CHECK ("quotes"."scheduled_deposit_invoices"."status" in ('waiting', 'blocked', 'issued')),
	CONSTRAINT "scheduled_deposit_invoices_issued_check" CHECK (("quotes"."scheduled_deposit_invoices"."status" = 'issued') = ("quotes"."scheduled_deposit_invoices"."invoice_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP CONSTRAINT "signature_requests_version_id_unique";--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ALTER COLUMN "advance_kind_default" SET DEFAULT 'deposit';--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD COLUMN "kind" "quotes"."signature_request_kind" DEFAULT 'quote' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."contract_evidence" ADD CONSTRAINT "contract_evidence_request_id_signature_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "quotes"."signature_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."contract_evidence" ADD CONSTRAINT "contract_evidence_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "quotes"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."contract_signer_acts" ADD CONSTRAINT "contract_signer_acts_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "quotes"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."contract_signer_acts" ADD CONSTRAINT "contract_signer_acts_signer_id_quote_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "quotes"."quote_signers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."contract_template_acceptances" ADD CONSTRAINT "contract_template_acceptances_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "quotes"."contract_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."contract_template_clauses" ADD CONSTRAINT "contract_template_clauses_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "quotes"."contract_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."contracts" ADD CONSTRAINT "contracts_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."contracts" ADD CONSTRAINT "contracts_quote_version_id_quote_versions_id_fk" FOREIGN KEY ("quote_version_id") REFERENCES "quotes"."quote_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."contracts" ADD CONSTRAINT "contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "quotes"."contract_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."scheduled_deposit_invoices" ADD CONSTRAINT "scheduled_deposit_invoices_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "quotes"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."scheduled_deposit_invoices" ADD CONSTRAINT "scheduled_deposit_invoices_version_id_quote_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "quotes"."quote_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."scheduled_deposit_invoices" ADD CONSTRAINT "scheduled_deposit_invoices_schedule_item_id_payment_schedule_items_id_fk" FOREIGN KEY ("schedule_item_id") REFERENCES "quotes"."payment_schedule_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."scheduled_deposit_invoices" ADD CONSTRAINT "scheduled_deposit_invoices_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "quotes"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_evidence_organization_idx" ON "quotes"."contract_evidence" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_signer_acts_organization_idx" ON "quotes"."contract_signer_acts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_template_acceptances_organization_idx" ON "quotes"."contract_template_acceptances" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_template_clauses_organization_idx" ON "quotes"."contract_template_clauses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contract_template_clauses_template_idx" ON "quotes"."contract_template_clauses" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "contract_templates_organization_idx" ON "quotes"."contract_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contracts_organization_idx" ON "quotes"."contracts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scheduled_deposit_invoices_organization_idx" ON "quotes"."scheduled_deposit_invoices" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD CONSTRAINT "signature_requests_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "quotes"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "signature_requests_quote_version_unique" ON "quotes"."signature_requests" USING btree ("version_id") WHERE kind <> 'contract';--> statement-breakpoint
CREATE UNIQUE INDEX "signature_requests_contract_unique" ON "quotes"."signature_requests" USING btree ("contract_id") WHERE contract_id is not null;--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD CONSTRAINT "signature_requests_kind_check" CHECK (("quotes"."signature_requests"."kind" = 'quote') = ("quotes"."signature_requests"."contract_id" is null));
--> statement-breakpoint
-- Réponse 2 de l'avocat (D17) : l'organisation qui n'avait rien choisi propose « acompte ».
UPDATE "quotes"."quote_settings" SET "advance_kind_default" = 'deposit' WHERE "advance_kind_default" IS NULL;
--> statement-breakpoint
ALTER TABLE "quotes"."contract_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."contract_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."contract_templates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."contract_templates" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "contract_templates_stamp" BEFORE INSERT OR UPDATE ON "quotes"."contract_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contract_templates_journal_deletion" BEFORE DELETE ON "quotes"."contract_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."contract_template_clauses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."contract_template_clauses" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."contract_template_clauses"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."contract_template_clauses" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "contract_template_clauses_stamp" BEFORE INSERT OR UPDATE ON "quotes"."contract_template_clauses"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contract_template_clauses_journal_deletion" BEFORE DELETE ON "quotes"."contract_template_clauses"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."contracts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."contracts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."contracts"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."contracts" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "contracts_stamp" BEFORE INSERT OR UPDATE ON "quotes"."contracts"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contracts_journal_deletion" BEFORE DELETE ON "quotes"."contracts"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."contract_template_acceptances" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."contract_template_acceptances" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."contract_template_acceptances"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."contract_template_acceptances" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "contract_template_acceptances_stamp" BEFORE INSERT OR UPDATE ON "quotes"."contract_template_acceptances"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contract_template_acceptances_journal_deletion" BEFORE DELETE ON "quotes"."contract_template_acceptances"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."contract_signer_acts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."contract_signer_acts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."contract_signer_acts"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."contract_signer_acts" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "contract_signer_acts_stamp" BEFORE INSERT OR UPDATE ON "quotes"."contract_signer_acts"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contract_signer_acts_journal_deletion" BEFORE DELETE ON "quotes"."contract_signer_acts"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."contract_evidence" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."contract_evidence" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."contract_evidence"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."contract_evidence" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "contract_evidence_stamp" BEFORE INSERT OR UPDATE ON "quotes"."contract_evidence"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contract_evidence_journal_deletion" BEFORE DELETE ON "quotes"."contract_evidence"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."scheduled_deposit_invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."scheduled_deposit_invoices" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."scheduled_deposit_invoices"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."scheduled_deposit_invoices" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "scheduled_deposit_invoices_stamp" BEFORE INSERT OR UPDATE ON "quotes"."scheduled_deposit_invoices"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "scheduled_deposit_invoices_journal_deletion" BEFORE DELETE ON "quotes"."scheduled_deposit_invoices"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
