-- Lot 38b (HUB-21, HUB-29 ; D10, D11, D12 ; ADR 0072) : modèles de messages de la planner et leurs
-- versions (en ajout seul : une version ne se modifie pas), adresses secrètes des flux de calendrier
-- (jeton haché ; seules la date de dernière lecture et la révocation se modifient). Schéma hub
-- seulement ; tables nouvelles.
CREATE TABLE "hub"."calendar_feeds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"event_id" uuid,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "calendar_feeds_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "calendar_feeds_token_hash_check" CHECK ("hub"."calendar_feeds"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "hub"."message_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "message_template_versions_template_version_unique" UNIQUE("template_id","version"),
	CONSTRAINT "message_template_versions_version_check" CHECK ("hub"."message_template_versions"."version" >= 1),
	CONSTRAINT "message_template_versions_subject_check" CHECK (char_length("hub"."message_template_versions"."subject") between 1 and 200),
	CONSTRAINT "message_template_versions_body_check" CHECK (char_length("hub"."message_template_versions"."body") between 1 and 5000)
);
--> statement-breakpoint
CREATE TABLE "hub"."message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type_id" uuid,
	"name" text NOT NULL,
	"locale" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "message_templates_name_check" CHECK (char_length("hub"."message_templates"."name") between 1 and 120),
	CONSTRAINT "message_templates_locale_check" CHECK ("hub"."message_templates"."locale" in ('fr', 'en')),
	CONSTRAINT "message_templates_version_check" CHECK ("hub"."message_templates"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "hub"."calendar_feeds" ADD CONSTRAINT "calendar_feeds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "hub"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub"."message_template_versions" ADD CONSTRAINT "message_template_versions_template_id_message_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "hub"."message_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_feeds_organization_idx" ON "hub"."calendar_feeds" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feeds_person_active_idx" ON "hub"."calendar_feeds" USING btree ("organization_id","user_id") WHERE event_id is null and revoked_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feeds_event_active_idx" ON "hub"."calendar_feeds" USING btree ("organization_id","user_id","event_id") WHERE event_id is not null and revoked_at is null;--> statement-breakpoint
CREATE INDEX "message_template_versions_organization_idx" ON "hub"."message_template_versions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "message_templates_organization_idx" ON "hub"."message_templates" USING btree ("organization_id");

--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "hub"."message_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."message_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."message_templates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "hub"."message_templates" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "hub"."message_template_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."message_template_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."message_template_versions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "hub"."message_template_versions" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "hub"."calendar_feeds" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."calendar_feeds" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."calendar_feeds"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "hub"."calendar_feeds" TO symbola_app;
--> statement-breakpoint
GRANT UPDATE ("last_used_at", "revoked_at") ON "hub"."calendar_feeds" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "message_templates_stamp" BEFORE INSERT OR UPDATE ON "hub"."message_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "message_templates_journal_deletion" BEFORE DELETE ON "hub"."message_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "message_template_versions_stamp" BEFORE INSERT OR UPDATE ON "hub"."message_template_versions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "message_template_versions_journal_deletion" BEFORE DELETE ON "hub"."message_template_versions"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "calendar_feeds_stamp" BEFORE INSERT OR UPDATE ON "hub"."calendar_feeds"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "calendar_feeds_journal_deletion" BEFORE DELETE ON "hub"."calendar_feeds"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
