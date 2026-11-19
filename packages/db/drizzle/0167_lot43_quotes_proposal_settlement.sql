-- Lot 43 (FAC-02, FAC-08 Divergent, FAC-09, FAC-15, GC-01, SEC-16 ; D1, D2, D5, D7 ; ADR 0087, ADR 0089) :
-- modèles de la page de proposition, mot d'accueil et relance avant expiration d'une version de devis,
-- références de virement et déclarations du payeur, relances d'impayés, réglages des relances et taux
-- de la clause de pénalités d'un particulier. Ajouts seulement (tables, colonnes facultatives,
-- contraintes sur des colonnes neuves) : l'ancien code continue de tourner pendant la migration.
-- RLS forcée sur les trois tables neuves, auteur et suppressions journalisées (DAT-06, SEC-19).
CREATE TABLE "quotes"."payment_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"schedule_item_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"declared_at" timestamp with time zone,
	"declared_paid_on" date,
	"declared_by_link_id" uuid,
	"declared_by_name" text,
	"reminders_suspended_at" timestamp with time zone,
	"reminders_suspension_reason" text,
	"reminders_suspended_by" uuid,
	"details_mailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "payment_references_schedule_item_id_unique" UNIQUE("schedule_item_id"),
	CONSTRAINT "payment_references_organization_reference_unique" UNIQUE("organization_id","reference"),
	CONSTRAINT "payment_references_reference_check" CHECK ("quotes"."payment_references"."reference" ~ '^SYM-[0-9]{4}-[0-9A-HJKMNP-TV-Z]{6}$'),
	CONSTRAINT "payment_references_declaration_check" CHECK (("quotes"."payment_references"."declared_at" is null and "quotes"."payment_references"."declared_paid_on" is null and "quotes"."payment_references"."declared_by_link_id" is null and "quotes"."payment_references"."declared_by_name" is null) or ("quotes"."payment_references"."declared_at" is not null and "quotes"."payment_references"."declared_paid_on" is not null and "quotes"."payment_references"."declared_by_link_id" is not null and char_length("quotes"."payment_references"."declared_by_name") between 1 and 200)),
	CONSTRAINT "payment_references_suspension_check" CHECK (("quotes"."payment_references"."reminders_suspended_at" is null and "quotes"."payment_references"."reminders_suspension_reason" is null) or ("quotes"."payment_references"."reminders_suspended_at" is not null and char_length(trim("quotes"."payment_references"."reminders_suspension_reason")) between 1 and 500))
);
--> statement-breakpoint
CREATE TABLE "quotes"."payment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"schedule_item_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"due_on" date NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "payment_reminders_item_rank_unique" UNIQUE("schedule_item_id","rank"),
	CONSTRAINT "payment_reminders_rank_check" CHECK ("quotes"."payment_reminders"."rank" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "quotes"."proposal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type_id" uuid,
	"greeting" text NOT NULL,
	"blocks" text[] NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "proposal_templates_organization_event_type_unique" UNIQUE NULLS NOT DISTINCT("organization_id","event_type_id"),
	CONSTRAINT "proposal_templates_greeting_check" CHECK (char_length("quotes"."proposal_templates"."greeting") between 1 and 4000),
	CONSTRAINT "proposal_templates_blocks_check" CHECK (cardinality("quotes"."proposal_templates"."blocks") between 1 and 6 and "quotes"."proposal_templates"."blocks" <@ array['greeting', 'organization', 'photos', 'quote', 'schedule', 'validity']::text[] and 'quote' = any("quotes"."proposal_templates"."blocks")),
	CONSTRAINT "proposal_templates_photos_check" CHECK (jsonb_typeof("quotes"."proposal_templates"."photos") = 'array' and jsonb_array_length("quotes"."proposal_templates"."photos") <= 3),
	CONSTRAINT "proposal_templates_version_check" CHECK ("quotes"."proposal_templates"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "expiry_reminder_days" integer;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "payment_reminder_days" integer[];--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "consumer_late_penalty_basis_points" integer;--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "proposal_greeting" text;--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "proposal_template_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "proposal_template_version" integer;--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "expiry_reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" ADD COLUMN "signing_code_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quotes"."payment_references" ADD CONSTRAINT "payment_references_schedule_item_id_payment_schedule_items_id_fk" FOREIGN KEY ("schedule_item_id") REFERENCES "quotes"."payment_schedule_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."payment_reminders" ADD CONSTRAINT "payment_reminders_schedule_item_id_payment_schedule_items_id_fk" FOREIGN KEY ("schedule_item_id") REFERENCES "quotes"."payment_schedule_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_references_organization_idx" ON "quotes"."payment_references" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_reminders_organization_idx" ON "quotes"."payment_reminders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "proposal_templates_organization_idx" ON "quotes"."proposal_templates" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD CONSTRAINT "quote_versions_proposal_template_id_proposal_templates_id_fk" FOREIGN KEY ("proposal_template_id") REFERENCES "quotes"."proposal_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD CONSTRAINT "quote_settings_expiry_reminder_days_check" CHECK ("quotes"."quote_settings"."expiry_reminder_days" is null or "quotes"."quote_settings"."expiry_reminder_days" between 1 and 30);--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD CONSTRAINT "quote_settings_payment_reminder_days_check" CHECK ("quotes"."quote_settings"."payment_reminder_days" is null or (cardinality("quotes"."quote_settings"."payment_reminder_days") between 1 and 5 and 1 <= all("quotes"."quote_settings"."payment_reminder_days") and 120 >= all("quotes"."quote_settings"."payment_reminder_days")));--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD CONSTRAINT "quote_settings_consumer_late_penalty_check" CHECK ("quotes"."quote_settings"."consumer_late_penalty_basis_points" is null or "quotes"."quote_settings"."consumer_late_penalty_basis_points" between 1 and 10000);--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD CONSTRAINT "quote_versions_proposal_greeting_check" CHECK ("quotes"."quote_versions"."proposal_greeting" is null or char_length("quotes"."quote_versions"."proposal_greeting") between 1 and 4000);
--> statement-breakpoint
ALTER TABLE "quotes"."proposal_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."proposal_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."proposal_templates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."proposal_templates" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "proposal_templates_stamp" BEFORE INSERT OR UPDATE ON "quotes"."proposal_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "proposal_templates_journal_deletion" BEFORE DELETE ON "quotes"."proposal_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."payment_references" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."payment_references" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."payment_references"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."payment_references" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "payment_references_stamp" BEFORE INSERT OR UPDATE ON "quotes"."payment_references"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "payment_references_journal_deletion" BEFORE DELETE ON "quotes"."payment_references"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "quotes"."payment_reminders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes"."payment_reminders" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "quotes"."payment_reminders"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "quotes"."payment_reminders" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "payment_reminders_stamp" BEFORE INSERT OR UPDATE ON "quotes"."payment_reminders"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "payment_reminders_journal_deletion" BEFORE DELETE ON "quotes"."payment_reminders"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
