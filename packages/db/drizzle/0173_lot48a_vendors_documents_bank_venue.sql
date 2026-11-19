-- Lot 48a (PRE-05, PRE-06, PRE-10, SEC-27, DAT-08 ; D3 à D5 ; ADR 0093) : prestataires. Schéma vendors
-- seulement : natures de pièces (vendor_document_kinds) et pièces à échéance (vendor_documents),
-- journal des changements d'IBAN (vendor_bank_changes), IBAN, BIC et note confidentielle chiffrés sur
-- la fiche, sens des champs de lieu pour les contrôles du chrono (vendor_type_fields.rule_key), délai
-- d'alerte des pièces. Ajout seul (tables, colonnes facultatives ou avec valeur par défaut,
-- contraintes) : compatible avec la version précédente du code (ARC-14).
CREATE TABLE "vendors"."vendor_bank_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"previous_masked" text,
	"next_masked" text,
	"changed_by_user_id" uuid,
	"changed_by_link_id" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_bank_changes_author_check" CHECK (("vendors"."vendor_bank_changes"."changed_by_user_id" is null) <> ("vendors"."vendor_bank_changes"."changed_by_link_id" is null)),
	CONSTRAINT "vendor_bank_changes_verified_check" CHECK (("vendors"."vendor_bank_changes"."verified_at" is null) = ("vendors"."vendor_bank_changes"."verified_by_user_id" is null)),
	CONSTRAINT "vendor_bank_changes_masked_check" CHECK (("vendors"."vendor_bank_changes"."previous_masked" is null or "vendors"."vendor_bank_changes"."previous_masked" ~ '^[A-Z]{2}[0-9]{2} [•  0-9A-Z]{4,40}$') and ("vendors"."vendor_bank_changes"."next_masked" is null or "vendors"."vendor_bank_changes"."next_masked" ~ '^[A-Z]{2}[0-9]{2} [•  0-9A-Z]{4,40}$') and ("vendors"."vendor_bank_changes"."previous_masked" is not null or "vendors"."vendor_bank_changes"."next_masked" is not null))
);
--> statement-breakpoint
CREATE TABLE "vendors"."vendor_document_kinds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"expires" boolean DEFAULT true NOT NULL,
	"starter_key" text,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_document_kinds_starter_key_unique" UNIQUE("organization_id","starter_key"),
	CONSTRAINT "vendor_document_kinds_label_check" CHECK (char_length("vendors"."vendor_document_kinds"."label") between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "vendors"."vendor_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"kind_id" uuid NOT NULL,
	"status" text NOT NULL,
	"file_name" text,
	"file_key" text,
	"mime" text,
	"size_bytes" integer,
	"valid_until" date,
	"uploaded_by_user_id" uuid,
	"uploaded_by_link_id" uuid,
	"uploaded_at" timestamp with time zone,
	"requested_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"verified_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_documents_status_check" CHECK ("vendors"."vendor_documents"."status" in ('requested', 'to_verify', 'verified')),
	CONSTRAINT "vendor_documents_file_check" CHECK ((("vendors"."vendor_documents"."file_key" is null) = ("vendors"."vendor_documents"."status" = 'requested')) and (("vendors"."vendor_documents"."file_key" is null) = ("vendors"."vendor_documents"."file_name" is null)) and (("vendors"."vendor_documents"."file_key" is null) = ("vendors"."vendor_documents"."mime" is null)) and (("vendors"."vendor_documents"."file_key" is null) = ("vendors"."vendor_documents"."size_bytes" is null)) and ("vendors"."vendor_documents"."file_name" is null or char_length("vendors"."vendor_documents"."file_name") between 1 and 120)),
	CONSTRAINT "vendor_documents_verified_check" CHECK (("vendors"."vendor_documents"."status" = 'verified') = ("vendors"."vendor_documents"."verified_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" ADD COLUMN "document_alert_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" ADD COLUMN "document_kinds_seeded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" ADD COLUMN "venue_fields_seeded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" ADD COLUMN "rule_key" text;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "internal_note_sealed" text;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "internal_note_confidential_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "iban_sealed" text;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "bic_sealed" text;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "iban_masked" text;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_bank_changes" ADD CONSTRAINT "vendor_bank_changes_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_documents" ADD CONSTRAINT "vendor_documents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "vendors"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_documents" ADD CONSTRAINT "vendor_documents_kind_id_vendor_document_kinds_id_fk" FOREIGN KEY ("kind_id") REFERENCES "vendors"."vendor_document_kinds"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_bank_changes_organization_idx" ON "vendors"."vendor_bank_changes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_bank_changes_vendor_idx" ON "vendors"."vendor_bank_changes" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_document_kinds_organization_idx" ON "vendors"."vendor_document_kinds" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_documents_organization_idx" ON "vendors"."vendor_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_documents_vendor_idx" ON "vendors"."vendor_documents" USING btree ("vendor_id");--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" ADD CONSTRAINT "vendor_settings_document_alert_days_check" CHECK ("vendors"."vendor_settings"."document_alert_days" between 1 and 180);--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" ADD CONSTRAINT "vendor_type_fields_rule_key_check" CHECK ("vendors"."vendor_type_fields"."rule_key" is null or "vendors"."vendor_type_fields"."rule_key" ~ '^[a-z][a-z_]{1,40}$');--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD CONSTRAINT "vendors_sealed_fields_check" CHECK (("vendors"."vendors"."internal_note_sealed" is null or ("vendors"."vendors"."internal_note" is null and "vendors"."vendors"."internal_note_sealed" like 'f1:%')) and ("vendors"."vendors"."iban_sealed" is null or "vendors"."vendors"."iban_sealed" like 'f1:%') and ("vendors"."vendors"."bic_sealed" is null or "vendors"."vendors"."bic_sealed" like 'f1:%') and (("vendors"."vendors"."iban_sealed" is null) = ("vendors"."vendors"."iban_masked" is null)) and ("vendors"."vendors"."bic_sealed" is null or "vendors"."vendors"."iban_sealed" is not null));
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées
-- (CLAUDE.md § 2.3, SEC-10, SEC-11, DAT-06, SEC-19).
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_document_kinds" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_document_kinds" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_document_kinds"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_document_kinds" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "vendor_document_kinds_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_document_kinds"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_document_kinds_journal_deletion" BEFORE DELETE ON "vendors"."vendor_document_kinds"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_documents"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_documents" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "vendor_documents_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_documents"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_documents_journal_deletion" BEFORE DELETE ON "vendors"."vendor_documents"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_bank_changes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_bank_changes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "vendors"."vendor_bank_changes"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "vendors"."vendor_bank_changes" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "vendor_bank_changes_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_bank_changes"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_bank_changes_journal_deletion" BEFORE DELETE ON "vendors"."vendor_bank_changes"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
