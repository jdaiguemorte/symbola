-- Lot 47 (PAR-05, PRE-03, PRE-04, PRE-09, BUD-05 ; D1 à D8, D10 ; ADR 0085) : prestataires par lien.
-- Brief par poste et ses inspirations, réponse du prestataire par son lien (disponibilité, message,
-- relance, motif d'écart, facture déposée), scénarios d'options, avis du client sur une option,
-- engagement d'une décision « options », tâches de suivi rattachées au prestataire retenu,
-- feuilles de route J-30 et J-7 et leur confirmation, réglages de l'organisation. Schéma events seulement (la contrainte des natures
-- d'e-mails du hub a sa migration à part, 0163 ; l'historique du budget, 0164). Ajouts seuls, et deux colonnes d'auteur devenues
-- facultatives (facture déposée par un lien) : compatible avec l'image précédente (ARC-14).
ALTER TYPE "events"."event_activity_kind" ADD VALUE 'vendor_answered';--> statement-breakpoint
ALTER TYPE "events"."event_activity_kind" ADD VALUE 'vendor_invoice_received';--> statement-breakpoint
ALTER TYPE "events"."event_activity_kind" ADD VALUE 'vendor_roadmap_confirmed';--> statement-breakpoint
CREATE TABLE "events"."event_decision_option_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"link_id" uuid,
	"opinion" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_decision_option_feedback_unique" UNIQUE("decision_id","candidate_id","link_id"),
	CONSTRAINT "event_decision_option_feedback_opinion_check" CHECK ("events"."event_decision_option_feedback"."opinion" is null or "events"."event_decision_option_feedback"."opinion" in ('like', 'dislike')),
	CONSTRAINT "event_decision_option_feedback_comment_check" CHECK ("events"."event_decision_option_feedback"."comment" is null or char_length("events"."event_decision_option_feedback"."comment") between 1 and 500),
	CONSTRAINT "event_decision_option_feedback_content_check" CHECK ("events"."event_decision_option_feedback"."opinion" is not null or "events"."event_decision_option_feedback"."comment" is not null)
);
--> statement-breakpoint
CREATE TABLE "events"."vendor_brief_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"brief_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_brief_documents_unique" UNIQUE("brief_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "events"."vendor_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"vendor_slot_id" uuid NOT NULL,
	"need" text NOT NULL,
	"guest_count" integer,
	"indicative_budget_cents" integer,
	"show_budget" boolean DEFAULT false NOT NULL,
	"deadline" date NOT NULL,
	"sent_at" timestamp with time zone,
	"sent_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_briefs_slot_unique" UNIQUE("vendor_slot_id"),
	CONSTRAINT "vendor_briefs_need_check" CHECK (char_length("events"."vendor_briefs"."need") between 1 and 4000),
	CONSTRAINT "vendor_briefs_guest_count_check" CHECK ("events"."vendor_briefs"."guest_count" is null or "events"."vendor_briefs"."guest_count" between 0 and 100000),
	CONSTRAINT "vendor_briefs_budget_check" CHECK ("events"."vendor_briefs"."indicative_budget_cents" is null or "events"."vendor_briefs"."indicative_budget_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "events"."vendor_coordination_settings" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"brief_deadline_days" integer DEFAULT 7 NOT NULL,
	"brief_reminder" boolean DEFAULT true NOT NULL,
	"roadmap_month" boolean DEFAULT true NOT NULL,
	"roadmap_week" boolean DEFAULT true NOT NULL,
	"roadmap_alert_days" integer DEFAULT 3 NOT NULL,
	"follow_up_tasks" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_coordination_settings_deadline_check" CHECK ("events"."vendor_coordination_settings"."brief_deadline_days" between 1 and 60),
	CONSTRAINT "vendor_coordination_settings_alert_check" CHECK ("events"."vendor_coordination_settings"."roadmap_alert_days" between 1 and 6)
);
--> statement-breakpoint
CREATE TABLE "events"."vendor_roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"program_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_roadmaps_stage_unique" UNIQUE("candidate_id","stage"),
	CONSTRAINT "vendor_roadmaps_stage_check" CHECK ("events"."vendor_roadmaps"."stage" in ('j30', 'j7'))
);
--> statement-breakpoint
CREATE TABLE "events"."vendor_scenario_choices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"scenario_id" uuid NOT NULL,
	"vendor_slot_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_scenario_choices_slot_unique" UNIQUE("scenario_id","vendor_slot_id")
);
--> statement-breakpoint
CREATE TABLE "events"."vendor_scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_scenarios_name_check" CHECK (char_length("events"."vendor_scenarios"."name") between 1 and 120)
);
--> statement-breakpoint
ALTER TABLE "events"."event_document_versions" ALTER COLUMN "uploaded_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_documents" ALTER COLUMN "uploaded_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_decisions" ADD COLUMN "engaged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."event_documents" ADD COLUMN "uploaded_by_link_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "follow_up_candidate_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "brief_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "availability" text;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "answered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "answer_message" text;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "reminded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "dismissal_reason" text;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "invoice_document_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_decision_option_feedback" ADD CONSTRAINT "event_decision_option_feedback_decision_id_event_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "events"."event_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_decision_option_feedback" ADD CONSTRAINT "event_decision_option_feedback_candidate_id_event_vendor_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "events"."event_vendor_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_decision_option_feedback" ADD CONSTRAINT "event_decision_option_feedback_link_id_event_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "events"."event_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_brief_documents" ADD CONSTRAINT "vendor_brief_documents_brief_id_vendor_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "events"."vendor_briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_brief_documents" ADD CONSTRAINT "vendor_brief_documents_document_id_event_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "events"."event_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_briefs" ADD CONSTRAINT "vendor_briefs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_briefs" ADD CONSTRAINT "vendor_briefs_vendor_slot_id_event_vendor_slots_id_fk" FOREIGN KEY ("vendor_slot_id") REFERENCES "events"."event_vendor_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_roadmaps" ADD CONSTRAINT "vendor_roadmaps_candidate_id_event_vendor_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "events"."event_vendor_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_scenario_choices" ADD CONSTRAINT "vendor_scenario_choices_scenario_id_vendor_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "events"."vendor_scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_scenario_choices" ADD CONSTRAINT "vendor_scenario_choices_vendor_slot_id_event_vendor_slots_id_fk" FOREIGN KEY ("vendor_slot_id") REFERENCES "events"."event_vendor_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_scenario_choices" ADD CONSTRAINT "vendor_scenario_choices_candidate_id_event_vendor_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "events"."event_vendor_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_scenarios" ADD CONSTRAINT "vendor_scenarios_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_decision_option_feedback_organization_idx" ON "events"."event_decision_option_feedback" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "event_decision_option_feedback_decision_idx" ON "events"."event_decision_option_feedback" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "vendor_brief_documents_organization_idx" ON "events"."vendor_brief_documents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_briefs_organization_idx" ON "events"."vendor_briefs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_briefs_event_idx" ON "events"."vendor_briefs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "vendor_roadmaps_organization_idx" ON "events"."vendor_roadmaps" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_roadmaps_candidate_idx" ON "events"."vendor_roadmaps" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "vendor_scenario_choices_organization_idx" ON "events"."vendor_scenario_choices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_scenarios_organization_idx" ON "events"."vendor_scenarios" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_scenarios_event_idx" ON "events"."vendor_scenarios" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "events"."event_documents" ADD CONSTRAINT "event_documents_uploaded_by_link_id_event_links_id_fk" FOREIGN KEY ("uploaded_by_link_id") REFERENCES "events"."event_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD CONSTRAINT "event_tasks_follow_up_candidate_id_event_vendor_candidates_id_fk" FOREIGN KEY ("follow_up_candidate_id") REFERENCES "events"."event_vendor_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD CONSTRAINT "event_vendor_candidates_brief_id_vendor_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "events"."vendor_briefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD CONSTRAINT "event_vendor_candidates_invoice_document_id_event_documents_id_fk" FOREIGN KEY ("invoice_document_id") REFERENCES "events"."event_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_tasks_follow_up_candidate_idx" ON "events"."event_tasks" USING btree ("follow_up_candidate_id");--> statement-breakpoint
CREATE INDEX "event_vendor_candidates_brief_idx" ON "events"."event_vendor_candidates" USING btree ("brief_id");--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD CONSTRAINT "event_vendor_candidates_availability_check" CHECK ("events"."event_vendor_candidates"."availability" is null or "events"."event_vendor_candidates"."availability" in ('available', 'unavailable'));--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD CONSTRAINT "event_vendor_candidates_answer_message_check" CHECK ("events"."event_vendor_candidates"."answer_message" is null or char_length("events"."event_vendor_candidates"."answer_message") between 1 and 1000);--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD CONSTRAINT "event_vendor_candidates_dismissal_reason_check" CHECK ("events"."event_vendor_candidates"."dismissal_reason" is null or "events"."event_vendor_candidates"."dismissal_reason" in ('unavailable', 'other_chosen'));--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."vendor_briefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"."vendor_briefs" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON "events"."vendor_briefs"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."vendor_briefs" TO symbola_app;
ALTER TABLE "events"."vendor_brief_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"."vendor_brief_documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON "events"."vendor_brief_documents"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."vendor_brief_documents" TO symbola_app;
ALTER TABLE "events"."vendor_scenarios" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"."vendor_scenarios" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON "events"."vendor_scenarios"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."vendor_scenarios" TO symbola_app;
ALTER TABLE "events"."vendor_scenario_choices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"."vendor_scenario_choices" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON "events"."vendor_scenario_choices"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."vendor_scenario_choices" TO symbola_app;
ALTER TABLE "events"."event_decision_option_feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"."event_decision_option_feedback" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON "events"."event_decision_option_feedback"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_decision_option_feedback" TO symbola_app;
ALTER TABLE "events"."vendor_roadmaps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"."vendor_roadmaps" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON "events"."vendor_roadmaps"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."vendor_roadmaps" TO symbola_app;
ALTER TABLE "events"."vendor_coordination_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events"."vendor_coordination_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_isolation ON "events"."vendor_coordination_settings"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."vendor_coordination_settings" TO symbola_app;
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "vendor_briefs_stamp" BEFORE INSERT OR UPDATE ON "events"."vendor_briefs"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
CREATE TRIGGER "vendor_briefs_journal_deletion" BEFORE DELETE ON "events"."vendor_briefs"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
CREATE TRIGGER "vendor_brief_documents_stamp" BEFORE INSERT OR UPDATE ON "events"."vendor_brief_documents"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
CREATE TRIGGER "vendor_brief_documents_journal_deletion" BEFORE DELETE ON "events"."vendor_brief_documents"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
CREATE TRIGGER "vendor_scenarios_stamp" BEFORE INSERT OR UPDATE ON "events"."vendor_scenarios"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
CREATE TRIGGER "vendor_scenarios_journal_deletion" BEFORE DELETE ON "events"."vendor_scenarios"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
CREATE TRIGGER "vendor_scenario_choices_stamp" BEFORE INSERT OR UPDATE ON "events"."vendor_scenario_choices"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
CREATE TRIGGER "vendor_scenario_choices_journal_deletion" BEFORE DELETE ON "events"."vendor_scenario_choices"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
CREATE TRIGGER "event_decision_option_feedback_stamp" BEFORE INSERT OR UPDATE ON "events"."event_decision_option_feedback"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
CREATE TRIGGER "event_decision_option_feedback_journal_deletion" BEFORE DELETE ON "events"."event_decision_option_feedback"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
CREATE TRIGGER "vendor_roadmaps_stamp" BEFORE INSERT OR UPDATE ON "events"."vendor_roadmaps"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
CREATE TRIGGER "vendor_roadmaps_journal_deletion" BEFORE DELETE ON "events"."vendor_roadmaps"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
CREATE TRIGGER "vendor_coordination_settings_stamp" BEFORE INSERT OR UPDATE ON "events"."vendor_coordination_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
CREATE TRIGGER "vendor_coordination_settings_journal_deletion" BEFORE DELETE ON "events"."vendor_coordination_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
