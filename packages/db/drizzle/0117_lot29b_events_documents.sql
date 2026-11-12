-- Lot 29b (JRJ-04, décision D8 ; ADR 0064) : documents de l'événement (plan de
-- table, plans, plan B), fichiers privés contrôlés à l'envoi ; et choix des
-- documents embarqués pour le jour J, propre à l'événement. Une pièce embarquée
-- vient d'un module (source) : pas de clé étrangère entre schémas, le module la
-- confirme par son service.ts.
CREATE TABLE "events"."event_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"label" text NOT NULL,
	"file_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_documents_label_check" CHECK (char_length("events"."event_documents"."label") between 1 and 200),
	CONSTRAINT "event_documents_size_check" CHECK ("events"."event_documents"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "events"."event_day_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_day_documents_unique" UNIQUE("event_id","source","source_id"),
	CONSTRAINT "event_day_documents_source_check" CHECK ("events"."event_day_documents"."source" in ('event_document', 'signed_quote', 'budget_attachment', 'candidate_quote'))
);
--> statement-breakpoint
ALTER TABLE "events"."event_documents" ADD CONSTRAINT "event_documents_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events"."event_day_documents" ADD CONSTRAINT "event_day_documents_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_documents_organization_idx" ON "events"."event_documents" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "event_documents_event_idx" ON "events"."event_documents" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "event_day_documents_organization_idx" ON "events"."event_day_documents" USING btree ("organization_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."event_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_documents"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "events"."event_day_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_day_documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_day_documents"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_documents" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_day_documents" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "event_documents_stamp" BEFORE INSERT OR UPDATE ON "events"."event_documents"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_documents_journal_deletion" BEFORE DELETE ON "events"."event_documents"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_day_documents_stamp" BEFORE INSERT OR UPDATE ON "events"."event_day_documents"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_day_documents_journal_deletion" BEFORE DELETE ON "events"."event_day_documents"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
