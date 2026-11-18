-- Lot 44 (CRM-01, CRM-02 ; D1 à D11 ; ADR 0084) : formulaire de contact public et pipeline en
-- colonnes. Schéma events seulement : étapes du pipeline (pipeline_stages) et étape d'une option
-- (events.pipeline_stage_id), formulaire de contact de l'organisation (contact_forms), demandes reçues
-- (prospect_requests), nature « stage_changed » du fil d'activité, et auteur facultatif de l'historique
-- des statuts (un prospect créé par le formulaire public n'a pas d'auteur). Ajout seul (tables et
-- colonne nouvelles, valeur ajoutée, contrainte relâchée) : compatible avec la version précédente du
-- code (ARC-14).
ALTER TYPE "events"."event_activity_kind" ADD VALUE 'stage_changed';--> statement-breakpoint
CREATE TABLE "events"."contact_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"slug" text NOT NULL,
	"hidden_fields" text[] DEFAULT '{}'::text[] NOT NULL,
	"privacy_policy_url" text,
	"allowed_origins" text[] DEFAULT '{}'::text[] NOT NULL,
	"notify_owner" boolean DEFAULT true NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "contact_forms_slug_check" CHECK ("events"."contact_forms"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length("events"."contact_forms"."slug") between 3 and 60),
	CONSTRAINT "contact_forms_hidden_fields_check" CHECK ("events"."contact_forms"."hidden_fields" <@ array['phone', 'date', 'place', 'budget', 'guests', 'eventType', 'source', 'message']::text[]),
	CONSTRAINT "contact_forms_privacy_url_check" CHECK ("events"."contact_forms"."privacy_policy_url" is null or ("events"."contact_forms"."privacy_policy_url" ~ '^https://' and char_length("events"."contact_forms"."privacy_policy_url") <= 500)),
	CONSTRAINT "contact_forms_origins_check" CHECK (coalesce(array_length("events"."contact_forms"."allowed_origins", 1), 0) <= 5),
	CONSTRAINT "contact_forms_locale_check" CHECK ("events"."contact_forms"."locale" in ('fr', 'en'))
);
--> statement-breakpoint
CREATE TABLE "events"."pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "pipeline_stages_label_check" CHECK (char_length("events"."pipeline_stages"."label") between 1 and 60)
);
--> statement-breakpoint
CREATE TABLE "events"."prospect_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid,
	"state" text NOT NULL,
	"message" text,
	"period" text,
	"budget_range" text,
	"pending" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "prospect_requests_state_check" CHECK (("events"."prospect_requests"."state" = 'received' and "events"."prospect_requests"."event_id" is not null and "events"."prospect_requests"."pending" is null) or ("events"."prospect_requests"."state" = 'to_review' and "events"."prospect_requests"."event_id" is null and "events"."prospect_requests"."pending" is not null)),
	CONSTRAINT "prospect_requests_text_check" CHECK (("events"."prospect_requests"."message" is null or char_length("events"."prospect_requests"."message") <= 5000) and ("events"."prospect_requests"."period" is null or char_length("events"."prospect_requests"."period") <= 100) and ("events"."prospect_requests"."budget_range" is null or char_length("events"."prospect_requests"."budget_range") <= 100))
);
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" ALTER COLUMN "changed_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "pipeline_stage_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."prospect_requests" ADD CONSTRAINT "prospect_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_forms_organization_idx" ON "events"."contact_forms" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_forms_slug_idx" ON "events"."contact_forms" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "pipeline_stages_organization_idx" ON "events"."pipeline_stages" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "prospect_requests_organization_idx" ON "events"."prospect_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "prospect_requests_event_idx" ON "events"."prospect_requests" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "events"."events" ADD CONSTRAINT "events_pipeline_stage_id_pipeline_stages_id_fk" FOREIGN KEY ("pipeline_stage_id") REFERENCES "events"."pipeline_stages"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."pipeline_stages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."pipeline_stages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."pipeline_stages"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."pipeline_stages" TO symbola_app;
--> statement-breakpoint
-- Le formulaire de contact (contact_forms) est l'exception écrite, comme la page de réservation du
-- lot 46 : son adresse est publique par nature (/contact/<adresse>), sa ligne se lit sans organisation
-- pour retrouver celle de l'adresse ; elle ne s'écrit que par son organisation. Rien de personnel n'y
-- figure (adresse, état, champs masqués, adresse de la politique, sites autorisés, langue).
ALTER TABLE "events"."contact_forms" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."contact_forms" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY public_lookup ON "events"."contact_forms" FOR SELECT
  USING (true);
--> statement-breakpoint
CREATE POLICY organization_insert ON "events"."contact_forms" FOR INSERT
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY organization_update ON "events"."contact_forms" FOR UPDATE
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY organization_delete ON "events"."contact_forms" FOR DELETE
  USING (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."contact_forms" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."prospect_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."prospect_requests" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."prospect_requests"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
-- Lot 39a (DAT-03, ADR 0073) : la demande d'un évènement à la corbeille est cachée avec lui.
CREATE POLICY event_visibility ON "events"."prospect_requests" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = prospect_requests.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."prospect_requests" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "pipeline_stages_stamp" BEFORE INSERT OR UPDATE ON "events"."pipeline_stages"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "pipeline_stages_journal_deletion" BEFORE DELETE ON "events"."pipeline_stages"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "contact_forms_stamp" BEFORE INSERT OR UPDATE ON "events"."contact_forms"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "contact_forms_journal_deletion" BEFORE DELETE ON "events"."contact_forms"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "prospect_requests_stamp" BEFORE INSERT OR UPDATE ON "events"."prospect_requests"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "prospect_requests_journal_deletion" BEFORE DELETE ON "events"."prospect_requests"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
