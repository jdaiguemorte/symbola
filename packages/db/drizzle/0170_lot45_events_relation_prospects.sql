-- Lot 45 (CRM-05, CRM-06, CRM-09, POR-07, HUB-21 ; D1 à D8 ; ADR 0090) : réponses en un clic,
-- relances des prospects, questionnaires. Schéma events seulement : messages échangés avec le contact
-- d'un évènement (event_messages), réglage des relances et brochure (prospect_follow_up_settings),
-- relances préparées (prospect_follow_ups), modèles de questionnaires versionnés
-- (questionnaire_templates, questionnaire_template_items), questionnaires envoyés et leurs réponses
-- (event_questionnaires, questionnaire_answers) ; rubrique « questionnaires » des liens personnels.
-- Ajout seul (tables nouvelles, contrainte élargie) : compatible avec la version précédente du code
-- (ARC-14).
CREATE TABLE "events"."event_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"contact_id" uuid,
	"kind" text NOT NULL,
	"delivery" text NOT NULL,
	"template_id" uuid,
	"template_version" integer,
	"subject" text,
	"body" text,
	"brochure_token_hash" text,
	"brochure_expires_at" timestamp with time zone,
	"sent_by_user_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_messages_brochure_token_hash_unique" UNIQUE("brochure_token_hash"),
	CONSTRAINT "event_messages_kind_check" CHECK ("events"."event_messages"."kind" in ('reply', 'follow_up', 'questionnaire', 'answered', 'stop')),
	CONSTRAINT "event_messages_delivery_check" CHECK (("events"."event_messages"."kind" in ('answered', 'stop') and "events"."event_messages"."delivery" = 'noted') or ("events"."event_messages"."kind" not in ('answered', 'stop') and "events"."event_messages"."delivery" in ('sent', 'prepared'))),
	CONSTRAINT "event_messages_text_check" CHECK (("events"."event_messages"."subject" is null or char_length("events"."event_messages"."subject") <= 200) and ("events"."event_messages"."body" is null or char_length("events"."event_messages"."body") <= 5000)),
	CONSTRAINT "event_messages_brochure_check" CHECK (("events"."event_messages"."brochure_token_hash" is null) = ("events"."event_messages"."brochure_expires_at" is null))
);
--> statement-breakpoint
CREATE TABLE "events"."event_questionnaires" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"contact_id" uuid,
	"link_id" uuid,
	"template_id" uuid,
	"template_version" integer NOT NULL,
	"name" text NOT NULL,
	"locale" text NOT NULL,
	"questions" jsonb NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_questionnaires_name_check" CHECK (char_length("events"."event_questionnaires"."name") between 1 and 120),
	CONSTRAINT "event_questionnaires_locale_check" CHECK ("events"."event_questionnaires"."locale" in ('fr', 'en')),
	CONSTRAINT "event_questionnaires_questions_check" CHECK (jsonb_typeof("events"."event_questionnaires"."questions") = 'array' and jsonb_array_length("events"."event_questionnaires"."questions") between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "events"."prospect_follow_up_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"auto_send" boolean DEFAULT false NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"brochure_storage_key" text,
	"brochure_file_name" text,
	"brochure_size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "prospect_follow_up_settings_steps_check" CHECK (jsonb_typeof("events"."prospect_follow_up_settings"."steps") = 'array' and jsonb_array_length("events"."prospect_follow_up_settings"."steps") <= 3),
	CONSTRAINT "prospect_follow_up_settings_brochure_check" CHECK (("events"."prospect_follow_up_settings"."brochure_storage_key" is null) = ("events"."prospect_follow_up_settings"."brochure_file_name" is null) and ("events"."prospect_follow_up_settings"."brochure_file_name" is null or char_length("events"."prospect_follow_up_settings"."brochure_file_name") between 1 and 200))
);
--> statement-breakpoint
CREATE TABLE "events"."prospect_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"contact_id" uuid,
	"anchor_message_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"ready_at" timestamp with time zone NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_message_id" uuid,
	"stopped_at" timestamp with time zone,
	"stop_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "prospect_follow_ups_rank_check" CHECK ("events"."prospect_follow_ups"."rank" between 1 and 3),
	CONSTRAINT "prospect_follow_ups_text_check" CHECK (char_length("events"."prospect_follow_ups"."subject") between 1 and 200 and char_length("events"."prospect_follow_ups"."body") between 1 and 5000),
	CONSTRAINT "prospect_follow_ups_state_check" CHECK (("events"."prospect_follow_ups"."stopped_at" is null) = ("events"."prospect_follow_ups"."stop_reason" is null) and not ("events"."prospect_follow_ups"."sent_at" is not null and "events"."prospect_follow_ups"."stopped_at" is not null)),
	CONSTRAINT "prospect_follow_ups_stop_reason_check" CHECK ("events"."prospect_follow_ups"."stop_reason" is null or "events"."prospect_follow_ups"."stop_reason" in ('answered', 'stage_changed', 'confirmed', 'lost', 'prospect_action', 'new_message', 'stopped', 'withdrawn', 'no_recipient'))
);
--> statement-breakpoint
CREATE TABLE "events"."questionnaire_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"questionnaire_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"value" jsonb NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "questionnaire_answers_value_check" CHECK (jsonb_typeof("events"."questionnaire_answers"."value") in ('string', 'array', 'number') and octet_length("events"."questionnaire_answers"."value"::text) <= 6000),
	CONSTRAINT "questionnaire_answers_resolution_check" CHECK ("events"."questionnaire_answers"."resolution" is null or "events"."questionnaire_answers"."resolution" in ('filled', 'applied', 'kept'))
);
--> statement-breakpoint
CREATE TABLE "events"."questionnaire_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"item_key" text NOT NULL,
	"label" text NOT NULL,
	"help" text,
	"nature" text NOT NULL,
	"choices" text[] DEFAULT '{}'::text[] NOT NULL,
	"event_field" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "questionnaire_template_items_label_check" CHECK (char_length("events"."questionnaire_template_items"."label") between 1 and 300 and ("events"."questionnaire_template_items"."help" is null or char_length("events"."questionnaire_template_items"."help") <= 500)),
	CONSTRAINT "questionnaire_template_items_key_check" CHECK ("events"."questionnaire_template_items"."item_key" ~ '^[a-z0-9_-]{1,60}$'),
	CONSTRAINT "questionnaire_template_items_nature_check" CHECK ("events"."questionnaire_template_items"."nature" in ('short_text', 'long_text', 'single_choice', 'multiple_choice', 'date', 'number', 'amount')),
	CONSTRAINT "questionnaire_template_items_choices_check" CHECK (("events"."questionnaire_template_items"."nature" in ('single_choice', 'multiple_choice')) = (coalesce(array_length("events"."questionnaire_template_items"."choices", 1), 0) between 2 and 30)),
	CONSTRAINT "questionnaire_template_items_event_field_check" CHECK ("events"."questionnaire_template_items"."event_field" is null or "events"."questionnaire_template_items"."event_field" in ('event_date', 'guests', 'budget', 'venue', 'city', 'style', 'event_type'))
);
--> statement-breakpoint
CREATE TABLE "events"."questionnaire_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_type_id" uuid,
	"name" text NOT NULL,
	"locale" text NOT NULL,
	"starter_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "questionnaire_templates_name_check" CHECK (char_length("events"."questionnaire_templates"."name") between 1 and 120),
	CONSTRAINT "questionnaire_templates_locale_check" CHECK ("events"."questionnaire_templates"."locale" in ('fr', 'en')),
	CONSTRAINT "questionnaire_templates_version_check" CHECK ("events"."questionnaire_templates"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_rubrics_check";--> statement-breakpoint
ALTER TABLE "events"."event_messages" ADD CONSTRAINT "event_messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_questionnaires" ADD CONSTRAINT "event_questionnaires_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_questionnaires" ADD CONSTRAINT "event_questionnaires_link_id_event_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "events"."event_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_questionnaires" ADD CONSTRAINT "event_questionnaires_template_id_questionnaire_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "events"."questionnaire_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_anchor_message_id_event_messages_id_fk" FOREIGN KEY ("anchor_message_id") REFERENCES "events"."event_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."prospect_follow_ups" ADD CONSTRAINT "prospect_follow_ups_sent_message_id_event_messages_id_fk" FOREIGN KEY ("sent_message_id") REFERENCES "events"."event_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."questionnaire_answers" ADD CONSTRAINT "questionnaire_answers_questionnaire_id_event_questionnaires_id_fk" FOREIGN KEY ("questionnaire_id") REFERENCES "events"."event_questionnaires"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."questionnaire_template_items" ADD CONSTRAINT "questionnaire_template_items_template_id_questionnaire_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "events"."questionnaire_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."questionnaire_templates" ADD CONSTRAINT "questionnaire_templates_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "events"."event_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_messages_organization_idx" ON "events"."event_messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_messages_event_idx" ON "events"."event_messages" USING btree ("event_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_messages_contact_idx" ON "events"."event_messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "event_questionnaires_organization_idx" ON "events"."event_questionnaires" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_questionnaires_event_idx" ON "events"."event_questionnaires" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_questionnaires_link_idx" ON "events"."event_questionnaires" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "event_questionnaires_contact_idx" ON "events"."event_questionnaires" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prospect_follow_up_settings_organization_idx" ON "events"."prospect_follow_up_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "prospect_follow_ups_organization_idx" ON "events"."prospect_follow_ups" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "prospect_follow_ups_event_idx" ON "events"."prospect_follow_ups" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prospect_follow_ups_anchor_rank_idx" ON "events"."prospect_follow_ups" USING btree ("anchor_message_id","rank");--> statement-breakpoint
CREATE INDEX "questionnaire_answers_organization_idx" ON "events"."questionnaire_answers" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questionnaire_answers_item_idx" ON "events"."questionnaire_answers" USING btree ("questionnaire_id","item_key");--> statement-breakpoint
CREATE INDEX "questionnaire_template_items_organization_idx" ON "events"."questionnaire_template_items" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "questionnaire_template_items_key_idx" ON "events"."questionnaire_template_items" USING btree ("template_id","version","item_key");--> statement-breakpoint
CREATE INDEX "questionnaire_templates_organization_idx" ON "events"."questionnaire_templates" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_rubrics_check" CHECK ("events"."event_links"."rubrics" <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes', 'guests', 'questionnaires']::text[]);
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées
-- (CLAUDE.md § 2.3, SEC-10, SEC-11, DAT-06, SEC-19).
--> statement-breakpoint
ALTER TABLE "events"."event_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_messages"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
-- Lot 39a (DAT-03, ADR 0073) : la ligne d'un évènement à la corbeille est cachée avec lui.
CREATE POLICY event_visibility ON "events"."event_messages" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_messages.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_messages" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "event_messages_stamp" BEFORE INSERT OR UPDATE ON "events"."event_messages"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_messages_journal_deletion" BEFORE DELETE ON "events"."event_messages"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."prospect_follow_up_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."prospect_follow_up_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."prospect_follow_up_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."prospect_follow_up_settings" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "prospect_follow_up_settings_stamp" BEFORE INSERT OR UPDATE ON "events"."prospect_follow_up_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "prospect_follow_up_settings_journal_deletion" BEFORE DELETE ON "events"."prospect_follow_up_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."prospect_follow_ups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."prospect_follow_ups" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."prospect_follow_ups"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
-- Lot 39a (DAT-03, ADR 0073) : la ligne d'un évènement à la corbeille est cachée avec lui.
CREATE POLICY event_visibility ON "events"."prospect_follow_ups" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = prospect_follow_ups.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."prospect_follow_ups" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "prospect_follow_ups_stamp" BEFORE INSERT OR UPDATE ON "events"."prospect_follow_ups"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "prospect_follow_ups_journal_deletion" BEFORE DELETE ON "events"."prospect_follow_ups"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."questionnaire_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."questionnaire_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."questionnaire_templates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."questionnaire_templates" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "questionnaire_templates_stamp" BEFORE INSERT OR UPDATE ON "events"."questionnaire_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "questionnaire_templates_journal_deletion" BEFORE DELETE ON "events"."questionnaire_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."questionnaire_template_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."questionnaire_template_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."questionnaire_template_items"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."questionnaire_template_items" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "questionnaire_template_items_stamp" BEFORE INSERT OR UPDATE ON "events"."questionnaire_template_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "questionnaire_template_items_journal_deletion" BEFORE DELETE ON "events"."questionnaire_template_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."event_questionnaires" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_questionnaires" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_questionnaires"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
-- Lot 39a (DAT-03, ADR 0073) : la ligne d'un évènement à la corbeille est cachée avec lui.
CREATE POLICY event_visibility ON "events"."event_questionnaires" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_questionnaires.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_questionnaires" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "event_questionnaires_stamp" BEFORE INSERT OR UPDATE ON "events"."event_questionnaires"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_questionnaires_journal_deletion" BEFORE DELETE ON "events"."event_questionnaires"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."questionnaire_answers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."questionnaire_answers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."questionnaire_answers"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."questionnaire_answers" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "questionnaire_answers_stamp" BEFORE INSERT OR UPDATE ON "events"."questionnaire_answers"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "questionnaire_answers_journal_deletion" BEFORE DELETE ON "events"."questionnaire_answers"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
