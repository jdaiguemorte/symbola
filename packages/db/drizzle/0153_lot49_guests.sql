-- Lot 49 (INV-01 à INV-04, INV-07, RGP-06 à RGP-08, RGP-18 ; D1, D3, D6 à D13 ; ADR 0082) : le
-- module Invités, dans son propre schéma (ADR 0012). Foyers et personnes (un enfant n'a aucun moyen
-- de contact, contrainte en base), réponses par temps fort, liste fermée des régimes, régimes
-- chiffrés au niveau du champ (ADR 0078), preuves d'accord, liens personnels (jamais pour un
-- enfant : référence composée), reports de purge, imports. Les évènements, temps forts et clients
-- sont désignés sans clé étrangère entre schémas (avenant de l'ADR 0012). Schéma nouveau : ajout
-- seul, compatible avec la version précédente du code (ARC-14).
CREATE SCHEMA "guests";
--> statement-breakpoint
CREATE TABLE "guests"."diet_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"guest_id" uuid,
	"given_by_guest_id" uuid,
	"text_version" text NOT NULL,
	"channel" text DEFAULT 'personal_link' NOT NULL,
	"legal_guardian" boolean DEFAULT false NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "diet_consents_channel_check" CHECK ("guests"."diet_consents"."channel" in ('personal_link')),
	CONSTRAINT "diet_consents_version_check" CHECK (char_length("guests"."diet_consents"."text_version") between 1 and 40),
	CONSTRAINT "diet_consents_dates_check" CHECK ("guests"."diet_consents"."withdrawn_at" is null or "guests"."diet_consents"."withdrawn_at" >= "guests"."diet_consents"."granted_at")
);
--> statement-breakpoint
CREATE TABLE "guests"."dietary_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"starter_key" text,
	"label" text,
	"hidden" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "dietary_options_starter_unique" UNIQUE("organization_id","starter_key"),
	CONSTRAINT "dietary_options_kind_check" CHECK ("guests"."dietary_options"."kind" in ('diet', 'allergen')),
	CONSTRAINT "dietary_options_label_check" CHECK (("guests"."dietary_options"."starter_key" is not null and "guests"."dietary_options"."label" is null) or ("guests"."dietary_options"."starter_key" is null and char_length("guests"."dietary_options"."label") between 1 and 60))
);
--> statement-breakpoint
CREATE TABLE "guests"."diets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"options_sealed" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "diets_guest_unique" UNIQUE("guest_id"),
	CONSTRAINT "diets_sealed_check" CHECK ("guests"."diets"."options_sealed" like 'f1:%')
);
--> statement-breakpoint
CREATE TABLE "guests"."event_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"responses_close_on" date,
	"ask_diet" boolean DEFAULT true NOT NULL,
	"ask_accommodation" boolean DEFAULT false NOT NULL,
	"ask_transport" boolean DEFAULT false NOT NULL,
	"reminder_days" integer[] DEFAULT '{21,7}'::integer[] NOT NULL,
	"invitations_sent_at" timestamp with time zone,
	"diet_purge_notice_at" timestamp with time zone,
	"purge_notice_at" timestamp with time zone,
	"diets_purged_at" timestamp with time zone,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_settings_event_unique" UNIQUE("event_id"),
	CONSTRAINT "event_settings_reminders_check" CHECK (cardinality("guests"."event_settings"."reminder_days") <= 3 and (cardinality("guests"."event_settings"."reminder_days") = 0 or (1 <= all("guests"."event_settings"."reminder_days") and 90 >= all("guests"."event_settings"."reminder_days"))))
);
--> statement-breakpoint
CREATE TABLE "guests"."guest_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"household_count" integer NOT NULL,
	"guest_count" integer NOT NULL,
	"undone_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "guest_imports_channel_check" CHECK ("guests"."guest_imports"."channel" in ('planner', 'client')),
	CONSTRAINT "guest_imports_counts_check" CHECK ("guests"."guest_imports"."household_count" >= 0 and "guests"."guest_imports"."guest_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "guests"."guest_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"guest_kind" text DEFAULT 'adult' NOT NULL,
	"token_hash" text NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_opened_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "guest_links_token_unique" UNIQUE("token_hash"),
	CONSTRAINT "guest_links_adult_check" CHECK ("guests"."guest_links"."guest_kind" = 'adult'),
	CONSTRAINT "guest_links_hash_check" CHECK ("guests"."guest_links"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "guests"."guests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"household_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"email" text,
	"phone" text,
	"age_range" text,
	"position" integer DEFAULT 0 NOT NULL,
	"opposed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "guests_id_kind_unique" UNIQUE("id","kind"),
	CONSTRAINT "guests_kind_check" CHECK ("guests"."guests"."kind" in ('adult', 'child')),
	CONSTRAINT "guests_first_name_check" CHECK (char_length("guests"."guests"."first_name") between 1 and 100),
	CONSTRAINT "guests_last_name_check" CHECK ("guests"."guests"."last_name" is null or char_length("guests"."guests"."last_name") between 1 and 100),
	CONSTRAINT "guests_email_check" CHECK ("guests"."guests"."email" is null or ("guests"."guests"."email" = lower(btrim("guests"."guests"."email")) and char_length("guests"."guests"."email") between 3 and 320)),
	CONSTRAINT "guests_phone_check" CHECK ("guests"."guests"."phone" is null or char_length("guests"."guests"."phone") between 3 and 40),
	CONSTRAINT "guests_age_range_check" CHECK ("guests"."guests"."age_range" is null or "guests"."guests"."age_range" in ('0-2', '3-5', '6-11', '12-17')),
	CONSTRAINT "guests_child_no_contact_check" CHECK ("guests"."guests"."kind" <> 'child' or ("guests"."guests"."email" is null and "guests"."guests"."phone" is null and "guests"."guests"."last_name" is null)),
	CONSTRAINT "guests_adult_age_check" CHECK ("guests"."guests"."kind" <> 'adult' or "guests"."guests"."age_range" is null)
);
--> statement-breakpoint
CREATE TABLE "guests"."household_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "household_groups_label_check" CHECK (char_length("guests"."household_groups"."label") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "guests"."households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"side_kind" text,
	"side_client_id" uuid,
	"group_id" uuid,
	"language" text DEFAULT 'fr' NOT NULL,
	"respondent_guest_id" uuid,
	"key_moment_ids" uuid[],
	"needs_accommodation" boolean,
	"needs_transport" boolean,
	"answered_at" timestamp with time zone,
	"invited_at" timestamp with time zone,
	"import_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "households_name_check" CHECK (char_length("guests"."households"."display_name") between 1 and 200),
	CONSTRAINT "households_side_check" CHECK (("guests"."households"."side_kind" is null and "guests"."households"."side_client_id" is null) or ("guests"."households"."side_kind" = 'both' and "guests"."households"."side_client_id" is null) or ("guests"."households"."side_kind" = 'client' and "guests"."households"."side_client_id" is not null)),
	CONSTRAINT "households_language_check" CHECK ("guests"."households"."language" in ('fr', 'en'))
);
--> statement-breakpoint
CREATE TABLE "guests"."module_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"impact_assessment_confirmed_at" timestamp with time zone,
	"impact_assessment_confirmed_by" uuid,
	"privacy_notice" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "module_settings_notice_check" CHECK ("guests"."module_settings"."privacy_notice" is null or char_length("guests"."module_settings"."privacy_notice") between 1 and 4000)
);
--> statement-breakpoint
CREATE TABLE "guests"."purge_postponements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"postponed_until" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "purge_postponements_event_unique" UNIQUE("event_id"),
	CONSTRAINT "purge_postponements_reason_check" CHECK (char_length(btrim("guests"."purge_postponements"."reason")) between 3 and 500)
);
--> statement-breakpoint
CREATE TABLE "guests"."rsvp_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"guest_id" uuid NOT NULL,
	"key_moment_id" uuid NOT NULL,
	"attending" boolean NOT NULL,
	"channel" text NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "rsvp_answers_guest_moment_unique" UNIQUE("guest_id","key_moment_id"),
	CONSTRAINT "rsvp_answers_channel_check" CHECK ("guests"."rsvp_answers"."channel" in ('link', 'planner', 'client'))
);
--> statement-breakpoint
ALTER TABLE "guests"."diet_consents" ADD CONSTRAINT "diet_consents_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "guests"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."diet_consents" ADD CONSTRAINT "diet_consents_given_by_guest_id_guests_id_fk" FOREIGN KEY ("given_by_guest_id") REFERENCES "guests"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."diets" ADD CONSTRAINT "diets_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "guests"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."guest_links" ADD CONSTRAINT "guest_links_adult_fk" FOREIGN KEY ("guest_id","guest_kind") REFERENCES "guests"."guests"("id","kind") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."guests" ADD CONSTRAINT "guests_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "guests"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."households" ADD CONSTRAINT "households_group_id_household_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "guests"."household_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."households" ADD CONSTRAINT "households_import_id_guest_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "guests"."guest_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests"."rsvp_answers" ADD CONSTRAINT "rsvp_answers_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "guests"."guests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diet_consents_organization_idx" ON "guests"."diet_consents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "diet_consents_guest_idx" ON "guests"."diet_consents" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "dietary_options_organization_idx" ON "guests"."dietary_options" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "diets_organization_idx" ON "guests"."diets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_settings_organization_idx" ON "guests"."event_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "guest_imports_organization_idx" ON "guests"."guest_imports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "guest_links_organization_idx" ON "guests"."guest_links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "guest_links_guest_idx" ON "guests"."guest_links" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "guests_organization_idx" ON "guests"."guests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "guests_household_idx" ON "guests"."guests" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "guests_event_idx" ON "guests"."guests" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "household_groups_organization_idx" ON "guests"."household_groups" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "household_groups_label_idx" ON "guests"."household_groups" USING btree ("event_id",lower("label"));--> statement-breakpoint
CREATE INDEX "households_organization_idx" ON "guests"."households" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "households_event_idx" ON "guests"."households" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "purge_postponements_organization_idx" ON "guests"."purge_postponements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rsvp_answers_organization_idx" ON "guests"."rsvp_answers" USING btree ("organization_id");

--> statement-breakpoint
-- Le rôle applicatif lit le schéma ; il n'en est pas propriétaire (SEC-11).
GRANT USAGE ON SCHEMA "guests" TO symbola_app;
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "guests"."module_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."module_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."module_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."module_settings" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."event_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."event_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."event_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."event_settings" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."household_groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."household_groups" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."household_groups"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."household_groups" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."guest_imports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."guest_imports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."guest_imports"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."guest_imports" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."households" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."households" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."households"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."households" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."guests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."guests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."guests"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."guests" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."rsvp_answers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."rsvp_answers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."rsvp_answers"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."rsvp_answers" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."dietary_options" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."dietary_options" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."dietary_options"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."dietary_options" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."diets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."diets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."diets"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."diets" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."diet_consents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."diet_consents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."diet_consents"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."diet_consents" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."guest_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."guest_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."guest_links"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."guest_links" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "guests"."purge_postponements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guests"."purge_postponements" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "guests"."purge_postponements"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "guests"."purge_postponements" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées (une purge en
-- masse écrit sa ligne de synthèse, app.audit_bulk).
CREATE TRIGGER "module_settings_stamp" BEFORE INSERT OR UPDATE ON "guests"."module_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "module_settings_journal_deletion" BEFORE DELETE ON "guests"."module_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_settings_stamp" BEFORE INSERT OR UPDATE ON "guests"."event_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_settings_journal_deletion" BEFORE DELETE ON "guests"."event_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "household_groups_stamp" BEFORE INSERT OR UPDATE ON "guests"."household_groups"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "household_groups_journal_deletion" BEFORE DELETE ON "guests"."household_groups"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "guest_imports_stamp" BEFORE INSERT OR UPDATE ON "guests"."guest_imports"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "guest_imports_journal_deletion" BEFORE DELETE ON "guests"."guest_imports"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "households_stamp" BEFORE INSERT OR UPDATE ON "guests"."households"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "households_journal_deletion" BEFORE DELETE ON "guests"."households"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "guests_stamp" BEFORE INSERT OR UPDATE ON "guests"."guests"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "guests_journal_deletion" BEFORE DELETE ON "guests"."guests"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "rsvp_answers_stamp" BEFORE INSERT OR UPDATE ON "guests"."rsvp_answers"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "rsvp_answers_journal_deletion" BEFORE DELETE ON "guests"."rsvp_answers"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "dietary_options_stamp" BEFORE INSERT OR UPDATE ON "guests"."dietary_options"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "dietary_options_journal_deletion" BEFORE DELETE ON "guests"."dietary_options"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "diets_stamp" BEFORE INSERT OR UPDATE ON "guests"."diets"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "diets_journal_deletion" BEFORE DELETE ON "guests"."diets"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "diet_consents_stamp" BEFORE INSERT OR UPDATE ON "guests"."diet_consents"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "diet_consents_journal_deletion" BEFORE DELETE ON "guests"."diet_consents"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "guest_links_stamp" BEFORE INSERT OR UPDATE ON "guests"."guest_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "guest_links_journal_deletion" BEFORE DELETE ON "guests"."guest_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "purge_postponements_stamp" BEFORE INSERT OR UPDATE ON "guests"."purge_postponements"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "purge_postponements_journal_deletion" BEFORE DELETE ON "guests"."purge_postponements"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
