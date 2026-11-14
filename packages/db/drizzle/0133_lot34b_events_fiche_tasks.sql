-- Lot 34b (EVT-03, CHR-02 ; décisions D10 à D13) : fiche d'identité et tâches.
-- - Lieux (D10) : une seule liste ; chaque lieu porte sa ville, ses horaires et son contact. Le
--   lieu de réception (venue_name, venue_city) devient le premier lieu, puis ses colonnes
--   disparaissent : un lieu du même nom (fiche importée, lieux du programme) est repris, sinon un
--   lieu est créé ; sans nom, la ville sert d'intitulé.
-- - Fiche (D11) : invités estimés et confirmés, style, notes.
-- - Tâches (D12, D13) : responsable « prestataire » (le prestataire retenu sur l'événement),
--   pièces jointes et commentaires réservés à l'équipe.
-- La valeur « vendor » s'ajoute au type sans être employée dans cette migration (ADD VALUE en
-- transaction : la valeur n'est utilisable qu'après la validation).
ALTER TYPE "events"."task_responsible" ADD VALUE 'vendor';
--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "city" text;
--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "start_time" time;
--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "end_time" time;
--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "contact_name" text;
--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "contact_phone" text;
--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "contact_email" text;
--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD CONSTRAINT "event_places_details_check" CHECK (("events"."event_places"."city" is null or char_length("events"."event_places"."city") <= 200) and ("events"."event_places"."contact_name" is null or char_length("events"."event_places"."contact_name") <= 200) and ("events"."event_places"."contact_phone" is null or char_length("events"."event_places"."contact_phone") <= 40) and ("events"."event_places"."contact_email" is null or char_length("events"."event_places"."contact_email") <= 320));
--> statement-breakpoint
-- D10 : un lieu du même nom que le lieu de réception devient le premier et prend la ville.
UPDATE "events"."event_places" AS p
SET "position" = (SELECT min(q."position") FROM "events"."event_places" q WHERE q."event_id" = e."id") - 1,
    "city" = coalesce(p."city", nullif(btrim(e."venue_city"), ''))
FROM "events"."events" e
WHERE p."event_id" = e."id"
  AND nullif(btrim(e."venue_name"), '') IS NOT NULL
  AND p."id" = (
    SELECT q."id" FROM "events"."event_places" q
    WHERE q."event_id" = e."id" AND lower(btrim(q."label")) = lower(btrim(e."venue_name"))
    ORDER BY q."position", q."created_at" LIMIT 1
  );
--> statement-breakpoint
-- Sinon, un lieu est créé en tête de liste.
INSERT INTO "events"."event_places" ("organization_id", "event_id", "label", "city", "position")
SELECT e."organization_id",
       e."id",
       coalesce(nullif(btrim(e."venue_name"), ''), btrim(e."venue_city")),
       CASE WHEN nullif(btrim(e."venue_name"), '') IS NOT NULL THEN nullif(btrim(e."venue_city"), '') END,
       coalesce((SELECT min(q."position") FROM "events"."event_places" q WHERE q."event_id" = e."id"), 1) - 1
FROM "events"."events" e
WHERE (nullif(btrim(e."venue_name"), '') IS NOT NULL OR nullif(btrim(e."venue_city"), '') IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM "events"."event_places" q
    WHERE q."event_id" = e."id"
      AND nullif(btrim(e."venue_name"), '') IS NOT NULL
      AND lower(btrim(q."label")) = lower(btrim(e."venue_name"))
  );
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN "venue_name";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN "venue_city";
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "guests_estimated" integer;
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "guests_confirmed" integer;
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "style" text;
--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "notes" text;
--> statement-breakpoint
ALTER TABLE "events"."events" ADD CONSTRAINT "events_guests_check" CHECK (("events"."events"."guests_estimated" is null or "events"."events"."guests_estimated" between 0 and 100000) and ("events"."events"."guests_confirmed" is null or "events"."events"."guests_confirmed" between 0 and 100000));
--> statement-breakpoint
ALTER TABLE "events"."events" ADD CONSTRAINT "events_identity_text_check" CHECK (("events"."events"."style" is null or char_length("events"."events"."style") <= 2000) and ("events"."events"."notes" is null or char_length("events"."events"."notes") <= 10000));
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "vendor_candidate_id" uuid;
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD CONSTRAINT "event_tasks_vendor_candidate_id_event_vendor_candidates_id_fk" FOREIGN KEY ("vendor_candidate_id") REFERENCES "events"."event_vendor_candidates"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_tasks_vendor_candidate_idx" ON "events"."event_tasks" USING btree ("vendor_candidate_id");
--> statement-breakpoint
CREATE TABLE "events"."event_task_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"label" text NOT NULL,
	"file_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_task_attachments_label_check" CHECK (char_length("events"."event_task_attachments"."label") between 1 and 200),
	CONSTRAINT "event_task_attachments_size_check" CHECK ("events"."event_task_attachments"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "events"."event_task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "event_task_comments_body_check" CHECK (char_length("events"."event_task_comments"."body") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "events"."event_task_attachments" ADD CONSTRAINT "event_task_attachments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events"."event_task_attachments" ADD CONSTRAINT "event_task_attachments_task_id_event_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "events"."event_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events"."event_task_comments" ADD CONSTRAINT "event_task_comments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events"."event_task_comments" ADD CONSTRAINT "event_task_comments_task_id_event_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "events"."event_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "event_task_attachments_organization_idx" ON "events"."event_task_attachments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "event_task_attachments_task_idx" ON "events"."event_task_attachments" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX "event_task_comments_organization_idx" ON "events"."event_task_comments" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "event_task_comments_task_idx" ON "events"."event_task_comments" USING btree ("task_id");
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11).
ALTER TABLE "events"."event_task_attachments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_task_attachments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_task_attachments"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
ALTER TABLE "events"."event_task_comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."event_task_comments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."event_task_comments"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_task_attachments" TO symbola_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."event_task_comments" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "event_task_attachments_stamp" BEFORE INSERT OR UPDATE ON "events"."event_task_attachments"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_task_attachments_journal_deletion" BEFORE DELETE ON "events"."event_task_attachments"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_task_comments_stamp" BEFORE INSERT OR UPDATE ON "events"."event_task_comments"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_task_comments_journal_deletion" BEFORE DELETE ON "events"."event_task_comments"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
