-- Lot 27b (POR-03, BUD-07, EVT-09 ; décisions D9 et D10) : décisions demandées
-- au client (options d'un poste, dépense, programme), contenu figé à la
-- demande ; réponse horodatée et nominative ; une décision répondue ou retirée
-- ne se modifie plus (garde en base), une nouvelle la remplace. Au fil
-- d'activité : « decision_made ».
ALTER TYPE "events"."event_activity_kind" ADD VALUE 'decision_made';
--> statement-breakpoint
CREATE TABLE "events"."event_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject_id" uuid,
	"slot_id" uuid,
	"title" text NOT NULL,
	"note" text,
	"snapshot" jsonb NOT NULL,
	"due_on" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"choice_id" uuid,
	"comment" text,
	"decided_by_link_id" uuid,
	"decided_by_name" text,
	"decided_at" timestamp with time zone,
	"replaces_decision_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_decisions_kind_check" CHECK ("events"."event_decisions"."kind" in ('option', 'expense', 'program')),
	CONSTRAINT "event_decisions_status_check" CHECK ("events"."event_decisions"."status" in ('pending', 'approved', 'declined', 'withdrawn')),
	CONSTRAINT "event_decisions_answer_check" CHECK (("events"."event_decisions"."status" in ('approved', 'declined')) = ("events"."event_decisions"."decided_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "events"."event_decisions" ADD CONSTRAINT "event_decisions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events"."event_decisions" ADD CONSTRAINT "event_decisions_decided_by_link_id_event_links_id_fk" FOREIGN KEY ("decided_by_link_id") REFERENCES "events"."event_links"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_decisions_organization_idx" ON "events"."event_decisions" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "event_decisions_event_idx" ON "events"."event_decisions" USING btree ("event_id");
--> statement-breakpoint
-- EVT-09 : une décision répondue ou retirée ne change plus. Seule une demande
-- d'oubli y touche encore : le lien effacé devient null, le nom copié et le
-- commentaire deviennent « [anonymisé] » ; et l'horodatage de la ligne.
CREATE FUNCTION "events"."guard_decision"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'pending' AND (
    NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.event_id IS DISTINCT FROM OLD.event_id
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.subject_id IS DISTINCT FROM OLD.subject_id
    OR NEW.slot_id IS DISTINCT FROM OLD.slot_id
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.note IS DISTINCT FROM OLD.note
    OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
    OR NEW.due_on IS DISTINCT FROM OLD.due_on
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.choice_id IS DISTINCT FROM OLD.choice_id
    OR (NEW.comment IS DISTINCT FROM OLD.comment AND NEW.comment IS DISTINCT FROM '[anonymisé]')
    OR (NEW.decided_by_name IS DISTINCT FROM OLD.decided_by_name AND NEW.decided_by_name IS DISTINCT FROM '[anonymisé]')
    OR NEW.decided_at IS DISTINCT FROM OLD.decided_at
    OR NEW.replaces_decision_id IS DISTINCT FROM OLD.replaces_decision_id
    OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
    OR (NEW.decided_by_link_id IS DISTINCT FROM OLD.decided_by_link_id AND NEW.decided_by_link_id IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'décision répondue ou retirée : elle ne se modifie plus, une nouvelle la remplace (EVT-09)' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER "event_decisions_guard" BEFORE UPDATE ON "events"."event_decisions"
  FOR EACH ROW EXECUTE FUNCTION "events"."guard_decision"();
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."event_decisions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_decisions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_decisions"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_decisions" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "event_decisions_stamp" BEFORE INSERT OR UPDATE ON "events"."event_decisions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_decisions_journal_deletion" BEFORE DELETE ON "events"."event_decisions"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
