-- Lot 55 (MSG-03, POR-06, POR-11 ; D3 ; ADR 0101) : sujets de discussion d'un évènement, leurs
-- prestataires, leurs messages (internes ou partagés) et pièces jointes ; abonnements push des
-- appareils des clients ; rubrique « Messages » du portail. Schéma events seulement. Ajout seul :
-- compatible avec la version précédente du code (ARC-14), qui ignore ces tables et la nouvelle valeur
-- de rubrique (un lien qui l'aurait reçue garde ses autres rubriques).
CREATE TABLE "events"."link_push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "link_push_subscriptions_endpoint_check" CHECK ("events"."link_push_subscriptions"."endpoint" ~ '^https://' and char_length("events"."link_push_subscriptions"."endpoint") <= 1000),
	CONSTRAINT "link_push_subscriptions_keys_check" CHECK (char_length("events"."link_push_subscriptions"."p256dh") between 80 and 100 and char_length("events"."link_push_subscriptions"."auth") between 16 and 32)
);
--> statement-breakpoint
CREATE TABLE "events"."message_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"label" text NOT NULL,
	"file_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "message_attachments_label_check" CHECK (char_length("events"."message_attachments"."label") between 1 and 200),
	CONSTRAINT "message_attachments_size_check" CHECK ("events"."message_attachments"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "events"."message_topic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "events"."message_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "message_topics_name_check" CHECK (char_length(btrim("events"."message_topics"."name")) between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "events"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"visibility" text NOT NULL,
	"author_kind" text NOT NULL,
	"author_user_id" uuid,
	"author_link_id" uuid,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "messages_visibility_check" CHECK ("events"."messages"."visibility" in ('internal', 'shared')),
	CONSTRAINT "messages_author_kind_check" CHECK ("events"."messages"."author_kind" in ('team', 'link')),
	CONSTRAINT "messages_internal_team_check" CHECK ("events"."messages"."visibility" = 'shared' or "events"."messages"."author_kind" = 'team'),
	CONSTRAINT "messages_author_check" CHECK (("events"."messages"."author_kind" = 'team' and "events"."messages"."author_link_id" is null) or ("events"."messages"."author_kind" = 'link' and "events"."messages"."author_user_id" is null)),
	CONSTRAINT "messages_author_name_check" CHECK (char_length("events"."messages"."author_name") between 1 and 200),
	CONSTRAINT "messages_body_check" CHECK (char_length("events"."messages"."body") between 1 and 5000)
);
--> statement-breakpoint
ALTER TABLE "events"."event_links" DROP CONSTRAINT "event_links_rubrics_check";--> statement-breakpoint
ALTER TABLE "events"."link_push_subscriptions" ADD CONSTRAINT "link_push_subscriptions_link_id_event_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "events"."event_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."message_attachments" ADD CONSTRAINT "message_attachments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "events"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."message_topic_links" ADD CONSTRAINT "message_topic_links_topic_id_message_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "events"."message_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."message_topic_links" ADD CONSTRAINT "message_topic_links_link_id_event_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "events"."event_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."message_topics" ADD CONSTRAINT "message_topics_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."messages" ADD CONSTRAINT "messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."messages" ADD CONSTRAINT "messages_topic_id_message_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "events"."message_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."messages" ADD CONSTRAINT "messages_author_link_id_event_links_id_fk" FOREIGN KEY ("author_link_id") REFERENCES "events"."event_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_push_subscriptions_organization_idx" ON "events"."link_push_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "link_push_subscriptions_link_idx" ON "events"."link_push_subscriptions" USING btree ("link_id");--> statement-breakpoint
CREATE UNIQUE INDEX "link_push_subscriptions_endpoint_idx" ON "events"."link_push_subscriptions" USING btree ("organization_id","endpoint");--> statement-breakpoint
CREATE INDEX "message_attachments_organization_idx" ON "events"."message_attachments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "message_attachments_message_idx" ON "events"."message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_topic_links_organization_idx" ON "events"."message_topic_links" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "message_topic_links_unique_idx" ON "events"."message_topic_links" USING btree ("topic_id","link_id");--> statement-breakpoint
CREATE INDEX "message_topic_links_link_idx" ON "events"."message_topic_links" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "message_topics_organization_idx" ON "events"."message_topics" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "message_topics_event_idx" ON "events"."message_topics" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "messages_organization_idx" ON "events"."messages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "messages_topic_idx" ON "events"."messages" USING btree ("topic_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_event_idx" ON "events"."messages" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "events"."event_links" ADD CONSTRAINT "event_links_rubrics_check" CHECK ("events"."event_links"."rubrics" <@ array['tasks', 'program', 'vendor_options', 'budget', 'quotes', 'guests', 'questionnaires', 'messages']::text[]);
--> statement-breakpoint
-- Row-Level Security, droits du rôle applicatif, auteur des lignes et suppressions journalisées (sauf
-- les abonnements push, techniques). Un message ne se modifie jamais : le rôle applicatif ne reçoit pas
-- UPDATE sur events.messages (sa visibilité, interne ou partagée, est donc figée à l'écriture).
--> statement-breakpoint
ALTER TABLE "events"."message_topics" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."message_topics" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."message_topics"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."message_topics" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "message_topics_stamp" BEFORE INSERT OR UPDATE ON "events"."message_topics"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "message_topics_journal_deletion" BEFORE DELETE ON "events"."message_topics"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."message_topic_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."message_topic_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."message_topic_links"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."message_topic_links" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "message_topic_links_stamp" BEFORE INSERT OR UPDATE ON "events"."message_topic_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "message_topic_links_journal_deletion" BEFORE DELETE ON "events"."message_topic_links"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."messages"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "events"."messages" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "messages_stamp" BEFORE INSERT OR UPDATE ON "events"."messages"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "messages_journal_deletion" BEFORE DELETE ON "events"."messages"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."message_attachments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."message_attachments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."message_attachments"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."message_attachments" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "message_attachments_stamp" BEFORE INSERT OR UPDATE ON "events"."message_attachments"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "message_attachments_journal_deletion" BEFORE DELETE ON "events"."message_attachments"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
ALTER TABLE "events"."link_push_subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."link_push_subscriptions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."link_push_subscriptions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."link_push_subscriptions" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "link_push_subscriptions_stamp" BEFORE INSERT OR UPDATE ON "events"."link_push_subscriptions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
