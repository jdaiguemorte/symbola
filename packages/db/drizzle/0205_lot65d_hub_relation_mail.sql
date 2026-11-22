-- Lot 65d (MSG-01, HUB-20, HUB-28 ; décisions de Julien du 22/11/2026 ; ADR 0110) : les messages de la
-- relation préparés par Symbola, envoyés par la planner de sa messagerie.
-- - hub.relation_mail_settings : qui envoie les messages de la relation, par organisation (« planner »
--   par défaut, sans ligne ; « symbola » garde l'envoi par Symbola, ADR 0102).
-- - hub.prepared_emails : un message de la relation « à envoyer », puis déclaré « envoyé » (date,
--   personne, modèle) ou « écarté ». Aucun contenu, aucune adresse : le destinataire est désigné par son
--   identifiant, le message est recomposé à l'ouverture depuis des identifiants (ref).
-- Schéma hub seulement. Deux tables nouvelles : compatible avec l'image précédente (ARC-14).
CREATE TABLE "hub"."prepared_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid,
	"kind" text NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient_id" uuid NOT NULL,
	"ref" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"origin" text NOT NULL,
	"automation_key" text,
	"source_key" text,
	"status" text DEFAULT 'to_send' NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_by_user_id" uuid,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "prepared_emails_kind_check" CHECK ("hub"."prepared_emails"."kind" ~ '^[a-z][a-z_]{0,59}$'),
	CONSTRAINT "prepared_emails_recipient_type_check" CHECK ("hub"."prepared_emails"."recipient_type" in ('event_link', 'contact', 'quote_signer')),
	CONSTRAINT "prepared_emails_origin_check" CHECK ("hub"."prepared_emails"."origin" in ('gesture', 'automation')),
	CONSTRAINT "prepared_emails_status_check" CHECK ("hub"."prepared_emails"."status" in ('to_send', 'sent', 'dismissed')),
	CONSTRAINT "prepared_emails_ref_check" CHECK (jsonb_typeof("hub"."prepared_emails"."ref") = 'object'),
	CONSTRAINT "prepared_emails_automation_key_check" CHECK ("hub"."prepared_emails"."automation_key" is null or "hub"."prepared_emails"."automation_key" ~ '^[a-z][a-z_]{0,59}$'),
	CONSTRAINT "prepared_emails_source_key_check" CHECK ("hub"."prepared_emails"."source_key" is null or char_length("hub"."prepared_emails"."source_key") between 1 and 300),
	CONSTRAINT "prepared_emails_sent_check" CHECK (("hub"."prepared_emails"."status" = 'sent') = ("hub"."prepared_emails"."sent_at" is not null)),
	CONSTRAINT "prepared_emails_dismissed_check" CHECK (("hub"."prepared_emails"."status" = 'dismissed') = ("hub"."prepared_emails"."dismissed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "hub"."relation_mail_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"sender" text DEFAULT 'planner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "relation_mail_settings_sender_check" CHECK ("hub"."relation_mail_settings"."sender" in ('planner', 'symbola'))
);
--> statement-breakpoint
ALTER TABLE "hub"."relation_mail_settings" ADD CONSTRAINT "relation_mail_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "hub"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "prepared_emails_organization_idx" ON "hub"."prepared_emails" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE INDEX "prepared_emails_event_idx" ON "hub"."prepared_emails" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prepared_emails_source_key_idx" ON "hub"."prepared_emails" USING btree ("organization_id","source_key") WHERE source_key is not null;--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). Aucune
-- suppression par l'app : un message préparé se clôt (envoyé, écarté) ; les lignes partent avec
-- l'organisation (fermeture du lot 35c, core.erase_organization_schema).
ALTER TABLE "hub"."relation_mail_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."relation_mail_settings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."relation_mail_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."relation_mail_settings" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "hub"."prepared_emails" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hub"."prepared_emails" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "hub"."prepared_emails"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "hub"."prepared_emails" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "relation_mail_settings_stamp" BEFORE INSERT OR UPDATE ON "hub"."relation_mail_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "relation_mail_settings_journal_deletion" BEFORE DELETE ON "hub"."relation_mail_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "prepared_emails_stamp" BEFORE INSERT OR UPDATE ON "hub"."prepared_emails"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "prepared_emails_journal_deletion" BEFORE DELETE ON "hub"."prepared_emails"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
