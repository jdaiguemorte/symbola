-- Lot 38a (MSG-01 ; D3, D5, D6 ; ADR 0072) : modèles des e-mails que l'organisation adresse aux tiers,
-- par nature et par langue. Un modèle absent vaut le texte de départ. Schéma hub seulement.
CREATE TABLE "hub"."email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"locale" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "email_templates_kind_locale_unique" UNIQUE("organization_id","kind","locale"),
	CONSTRAINT "email_templates_kind_check" CHECK ("hub"."email_templates"."kind" in ('client_link', 'client_link_renewed', 'vendor_link', 'vendor_link_renewed', 'task_reminder', 'quote_signature', 'contract_signature', 'order_first', 'signed_copy', 'program_published')),
	CONSTRAINT "email_templates_locale_check" CHECK ("hub"."email_templates"."locale" in ('fr', 'en')),
	CONSTRAINT "email_templates_subject_check" CHECK (char_length("hub"."email_templates"."subject") between 1 and 200),
	CONSTRAINT "email_templates_body_check" CHECK (char_length("hub"."email_templates"."body") between 1 and 5000)
);
--> statement-breakpoint
CREATE INDEX "email_templates_organization_idx" ON "hub"."email_templates" USING btree ("organization_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "hub"."email_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."email_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."email_templates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."email_templates" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "email_templates_stamp" BEFORE INSERT OR UPDATE ON "hub"."email_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "email_templates_journal_deletion" BEFORE DELETE ON "hub"."email_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
