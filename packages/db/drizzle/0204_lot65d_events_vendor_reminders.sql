-- Lot 65d (PRE-02, HUB-08 ; recette staging du 22/11/2026, maquette M16) : « Noter une relance ». La
-- planner déclare une relance qu'elle a faite elle-même (moyen, date, date du rappel) ; Symbola n'envoie
-- rien. La note facultative est une note interne du prestataire (note_id) : aucun texte libre ni
-- aucune donnée personnelle ici. Schéma events seulement. Ajout seul : compatible avec la version
-- précédente du code (ARC-14).
CREATE TABLE "events"."vendor_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"reminded_on" date NOT NULL,
	"recall_on" date,
	"note_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "vendor_reminders_channel_check" CHECK ("events"."vendor_reminders"."channel" in ('phone', 'email', 'sms', 'in_person')),
	CONSTRAINT "vendor_reminders_recall_check" CHECK ("events"."vendor_reminders"."recall_on" is null or "events"."vendor_reminders"."recall_on" >= "events"."vendor_reminders"."reminded_on")
);
--> statement-breakpoint
ALTER TABLE "events"."vendor_reminders" ADD CONSTRAINT "vendor_reminders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_reminders" ADD CONSTRAINT "vendor_reminders_candidate_id_event_vendor_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "events"."event_vendor_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."vendor_reminders" ADD CONSTRAINT "vendor_reminders_note_id_event_vendor_candidate_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "events"."event_vendor_candidate_notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_reminders_organization_idx" ON "events"."vendor_reminders" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "vendor_reminders_candidate_idx" ON "events"."vendor_reminders" USING btree ("candidate_id","reminded_on");
--> statement-breakpoint
ALTER TABLE "events"."vendor_reminders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."vendor_reminders" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."vendor_reminders"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."vendor_reminders" TO symbola_app;
--> statement-breakpoint
CREATE TRIGGER "vendor_reminders_stamp" BEFORE INSERT OR UPDATE ON "events"."vendor_reminders"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_reminders_journal_deletion" BEFORE DELETE ON "events"."vendor_reminders"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
