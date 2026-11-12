-- Lot 30a (JRJ-03, décision D4) : contacts du jour J saisis pour l'événement
-- (régisseur du domaine, taxi, pharmacie de garde), dans l'annuaire de l'écran du
-- jour J avec les numéros d'urgence nationaux (fichier de données).
CREATE TABLE "events"."event_day_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"phone" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_day_contacts_name_check" CHECK (char_length("events"."event_day_contacts"."name") between 1 and 120),
	CONSTRAINT "event_day_contacts_role_check" CHECK ("events"."event_day_contacts"."role" is null or char_length("events"."event_day_contacts"."role") between 1 and 120),
	CONSTRAINT "event_day_contacts_phone_check" CHECK (char_length("events"."event_day_contacts"."phone") between 3 and 40)
);
--> statement-breakpoint
ALTER TABLE "events"."event_day_contacts" ADD CONSTRAINT "event_day_contacts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_day_contacts_organization_idx" ON "events"."event_day_contacts" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "event_day_contacts_event_idx" ON "events"."event_day_contacts" USING btree ("event_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."event_day_contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_day_contacts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_day_contacts"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_day_contacts" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "event_day_contacts_stamp" BEFORE INSERT OR UPDATE ON "events"."event_day_contacts"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_day_contacts_journal_deletion" BEFORE DELETE ON "events"."event_day_contacts"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
