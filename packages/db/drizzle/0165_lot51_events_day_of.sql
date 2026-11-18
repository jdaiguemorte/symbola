-- Lot 51 (EVT-04, CHR-08, JRJ-05 à JRJ-09, ARC-09 ; D1 à D8 ; ADR 0091) : le jour J de terrain, dans
-- le schéma events. Le temps fort d'une séquence (program_items.key_moment_id, donc son jour) ; le
-- temps fort créé de lui-même (key_moments.auto_created) ; le temps fort et le jour d'une ligne de
-- modèle de programme ; les pointages (ajoutés, jamais écrasés), les décalages validés, les photos,
-- la main courante, les modèles de listes de contrôle, les listes et leurs cases, le bilan du
-- lendemain. Chaque écriture du jour J garde l'identifiant de son action, unique par organisation
-- (une action rejouée est ignorée). Ajout seul (tables, colonnes facultatives ou avec valeur par
-- défaut, index, contraintes) et une reprise de données : compatible avec la version précédente du
-- code (ARC-14).
CREATE TABLE "events"."day_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"checklist_id" uuid NOT NULL,
	"label" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"checked_at" timestamp with time zone,
	"checked_by" uuid,
	"check_action_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "day_checklist_items_label_check" CHECK (char_length("events"."day_checklist_items"."label") between 1 and 200),
	CONSTRAINT "day_checklist_items_check_check" CHECK (("events"."day_checklist_items"."checked_at" is null and "events"."day_checklist_items"."checked_by" is null) or ("events"."day_checklist_items"."checked_at" is not null and "events"."day_checklist_items"."checked_by" is not null))
);
--> statement-breakpoint
CREATE TABLE "events"."day_checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"starter_key" text,
	"name" text NOT NULL,
	"phase" text NOT NULL,
	"items" text[] DEFAULT '{}'::text[] NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "day_checklist_templates_starter_unique" UNIQUE("organization_id","starter_key"),
	CONSTRAINT "day_checklist_templates_name_check" CHECK (char_length("events"."day_checklist_templates"."name") between 1 and 100),
	CONSTRAINT "day_checklist_templates_phase_check" CHECK ("events"."day_checklist_templates"."phase" in ('setup', 'teardown')),
	CONSTRAINT "day_checklist_templates_items_check" CHECK (coalesce(array_length("events"."day_checklist_templates"."items", 1), 0) <= 100)
);
--> statement-breakpoint
CREATE TABLE "events"."day_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"key_moment_id" uuid,
	"template_id" uuid,
	"name" text NOT NULL,
	"phase" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "day_checklists_name_check" CHECK (char_length("events"."day_checklists"."name") between 1 and 100),
	CONSTRAINT "day_checklists_phase_check" CHECK ("events"."day_checklists"."phase" in ('setup', 'teardown'))
);
--> statement-breakpoint
CREATE TABLE "events"."day_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"program_item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"device_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "day_checkpoints_action_unique" UNIQUE("organization_id","action_id"),
	CONSTRAINT "day_checkpoints_kind_check" CHECK ("events"."day_checkpoints"."kind" in ('started', 'finished'))
);
--> statement-breakpoint
CREATE TABLE "events"."day_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"key_moment_id" uuid,
	"body" text NOT NULL,
	"severity" text,
	"device_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "day_incidents_action_unique" UNIQUE("organization_id","action_id"),
	CONSTRAINT "day_incidents_body_check" CHECK (char_length("events"."day_incidents"."body") between 1 and 2000),
	CONSTRAINT "day_incidents_severity_check" CHECK ("events"."day_incidents"."severity" is null or "events"."day_incidents"."severity" in ('info', 'follow_up', 'urgent'))
);
--> statement-breakpoint
CREATE TABLE "events"."day_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"state" text NOT NULL,
	"rejection" text,
	"storage_key" text,
	"content_type" text,
	"size_bytes" integer,
	"taken_at" timestamp with time zone NOT NULL,
	"taken_by" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "day_photos_action_unique" UNIQUE("organization_id","action_id"),
	CONSTRAINT "day_photos_subject_check" CHECK ("events"."day_photos"."subject" in ('incident', 'checklist_item', 'handover')),
	CONSTRAINT "day_photos_state_check" CHECK (("events"."day_photos"."state" = 'stored' and "events"."day_photos"."storage_key" is not null and "events"."day_photos"."content_type" is not null and "events"."day_photos"."size_bytes" > 0 and "events"."day_photos"."rejection" is null) or ("events"."day_photos"."state" = 'rejected' and "events"."day_photos"."storage_key" is null and "events"."day_photos"."rejection" in ('type', 'size', 'virus', 'unavailable')))
);
--> statement-breakpoint
CREATE TABLE "events"."day_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"prepared_at" timestamp with time zone NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "events"."day_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"key_moment_id" uuid,
	"late_item_id" uuid,
	"minutes" integer NOT NULL,
	"item_ids" uuid[] NOT NULL,
	"vendor_slot_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"validated_at" timestamp with time zone NOT NULL,
	"validated_by" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"outcome" text,
	"applied_at" timestamp with time zone,
	"program_version" integer,
	"notified_at" timestamp with time zone,
	"notified_count" integer,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "day_shifts_action_unique" UNIQUE("organization_id","action_id"),
	CONSTRAINT "day_shifts_minutes_check" CHECK ("events"."day_shifts"."minutes" between 1 and 720),
	CONSTRAINT "day_shifts_items_check" CHECK (coalesce(array_length("events"."day_shifts"."item_ids", 1), 0) between 1 and 200 and coalesce(array_length("events"."day_shifts"."vendor_slot_ids", 1), 0) <= 200),
	CONSTRAINT "day_shifts_outcome_check" CHECK ("events"."day_shifts"."outcome" is null or "events"."day_shifts"."outcome" in ('applied', 'out_of_day', 'items_missing'))
);
--> statement-breakpoint
ALTER TABLE "events"."key_moments" ADD COLUMN "auto_created" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."program_items" ADD COLUMN "key_moment_id" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_template_items" ADD COLUMN "moment_name" text;--> statement-breakpoint
ALTER TABLE "events"."program_template_items" ADD COLUMN "day_offset" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."day_checklist_items" ADD CONSTRAINT "day_checklist_items_checklist_id_day_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "events"."day_checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_checklists" ADD CONSTRAINT "day_checklists_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_checklists" ADD CONSTRAINT "day_checklists_key_moment_id_key_moments_id_fk" FOREIGN KEY ("key_moment_id") REFERENCES "events"."key_moments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_checklists" ADD CONSTRAINT "day_checklists_template_id_day_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "events"."day_checklist_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_checkpoints" ADD CONSTRAINT "day_checkpoints_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_checkpoints" ADD CONSTRAINT "day_checkpoints_program_item_id_program_items_id_fk" FOREIGN KEY ("program_item_id") REFERENCES "events"."program_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_incidents" ADD CONSTRAINT "day_incidents_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_incidents" ADD CONSTRAINT "day_incidents_key_moment_id_key_moments_id_fk" FOREIGN KEY ("key_moment_id") REFERENCES "events"."key_moments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_photos" ADD CONSTRAINT "day_photos_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_reports" ADD CONSTRAINT "day_reports_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_shifts" ADD CONSTRAINT "day_shifts_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_shifts" ADD CONSTRAINT "day_shifts_key_moment_id_key_moments_id_fk" FOREIGN KEY ("key_moment_id") REFERENCES "events"."key_moments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events"."day_shifts" ADD CONSTRAINT "day_shifts_late_item_id_program_items_id_fk" FOREIGN KEY ("late_item_id") REFERENCES "events"."program_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "day_checklist_items_organization_idx" ON "events"."day_checklist_items" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "day_checklist_items_checklist_idx" ON "events"."day_checklist_items" USING btree ("checklist_id");--> statement-breakpoint
CREATE INDEX "day_checklist_templates_organization_idx" ON "events"."day_checklist_templates" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "day_checklists_organization_idx" ON "events"."day_checklists" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "day_checklists_event_idx" ON "events"."day_checklists" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "day_checkpoints_organization_idx" ON "events"."day_checkpoints" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "day_checkpoints_event_idx" ON "events"."day_checkpoints" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "day_checkpoints_item_idx" ON "events"."day_checkpoints" USING btree ("program_item_id");--> statement-breakpoint
CREATE INDEX "day_incidents_organization_idx" ON "events"."day_incidents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "day_incidents_event_idx" ON "events"."day_incidents" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "day_photos_organization_idx" ON "events"."day_photos" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "day_photos_event_idx" ON "events"."day_photos" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "day_photos_subject_idx" ON "events"."day_photos" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "day_reports_organization_idx" ON "events"."day_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "day_reports_event_idx" ON "events"."day_reports" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "day_shifts_organization_idx" ON "events"."day_shifts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "day_shifts_event_idx" ON "events"."day_shifts" USING btree ("event_id");--> statement-breakpoint
ALTER TABLE "events"."program_items" ADD CONSTRAINT "program_items_key_moment_id_key_moments_id_fk" FOREIGN KEY ("key_moment_id") REFERENCES "events"."key_moments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "program_items_key_moment_idx" ON "events"."program_items" USING btree ("key_moment_id");--> statement-breakpoint
ALTER TABLE "events"."program_template_items" ADD CONSTRAINT "program_template_items_moment_check" CHECK (("events"."program_template_items"."moment_name" is null or char_length("events"."program_template_items"."moment_name") between 1 and 100) and "events"."program_template_items"."day_offset" between -3 and 6);
--> statement-breakpoint
-- Reprise de données (D1) : un évènement daté qui a un programme garde son chrono le jour de
-- l'évènement. S'il n'a aucun temps fort ce jour-là, un temps fort unique est créé de lui-même
-- (nom dans la langue de l'organisation, comme les données de départ day-of.json) ; puis chaque
-- séquence sans temps fort rejoint le premier temps fort du jour de l'évènement. Rien ne change à
-- l'écran : le programme se lit toujours le jour de l'évènement, et le temps fort créé de lui-même
-- n'est pas proposé aux invités. Annulable : 0165 en rollback retire ce temps fort et ce lien.
INSERT INTO "events"."key_moments" ("organization_id", "event_id", "name", "date", "position", "auto_created")
SELECT e."organization_id", e."id",
  CASE WHEN o."language" = 'en' THEN 'Event day' ELSE 'Jour J' END,
  e."event_date", 0, true
FROM "events"."events" e
LEFT JOIN "hub"."organizations" o ON o."id" = e."organization_id"
WHERE e."event_date" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "events"."program_items" i WHERE i."event_id" = e."id" AND i."deleted_at" IS NULL)
  AND NOT EXISTS (SELECT 1 FROM "events"."key_moments" m WHERE m."event_id" = e."id" AND m."date" = e."event_date" AND m."deleted_at" IS NULL);
--> statement-breakpoint
UPDATE "events"."program_items" i
SET "key_moment_id" = (
  SELECT m."id" FROM "events"."key_moments" m JOIN "events"."events" e ON e."id" = m."event_id"
  WHERE m."event_id" = i."event_id" AND m."date" = e."event_date" AND m."deleted_at" IS NULL
  ORDER BY m."start_time" ASC NULLS FIRST, m."position" ASC, m."created_at" ASC
  LIMIT 1
)
WHERE i."key_moment_id" IS NULL;
--> statement-breakpoint
-- Row-Level Security et droits du rôle applicatif (CLAUDE.md § 2.3, SEC-10, SEC-11). Le contenu d'un
-- évènement supprimé est caché avec lui (ADR 0073). Pointages, incidents et photos s'ajoutent et ne se
-- modifient pas : le rôle applicatif n'a pas UPDATE sur eux.
ALTER TABLE "events"."day_checkpoints" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."day_checkpoints" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."day_checkpoints"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."day_checkpoints" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = day_checkpoints.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "events"."day_checkpoints" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."day_shifts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."day_shifts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."day_shifts"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."day_shifts" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = day_shifts.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."day_shifts" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."day_photos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."day_photos" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."day_photos"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."day_photos" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = day_photos.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "events"."day_photos" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."day_incidents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."day_incidents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."day_incidents"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."day_incidents" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = day_incidents.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "events"."day_incidents" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."day_checklists" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."day_checklists" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."day_checklists"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."day_checklists" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = day_checklists.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."day_checklists" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."day_reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."day_reports" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."day_reports"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."day_reports" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = day_reports.event_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."day_reports" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."day_checklist_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."day_checklist_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."day_checklist_items"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
CREATE POLICY checklist_visibility ON "events"."day_checklist_items" AS RESTRICTIVE
  USING (EXISTS (SELECT 1 FROM "events"."day_checklists" c WHERE c.id = day_checklist_items.checklist_id));
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."day_checklist_items" TO symbola_app;
--> statement-breakpoint
ALTER TABLE "events"."day_checklist_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "events"."day_checklist_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organization_isolation ON "events"."day_checklist_templates"
  USING (organization_id = current_setting('app.organization_id', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.organization_id', true)::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "events"."day_checklist_templates" TO symbola_app;
--> statement-breakpoint
-- DAT-06 et SEC-19 (lot 23a) : auteur de chaque ligne, suppressions journalisées.
CREATE TRIGGER "day_checkpoints_stamp" BEFORE INSERT OR UPDATE ON "events"."day_checkpoints"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "day_checkpoints_journal_deletion" BEFORE DELETE ON "events"."day_checkpoints"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "day_shifts_stamp" BEFORE INSERT OR UPDATE ON "events"."day_shifts"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "day_shifts_journal_deletion" BEFORE DELETE ON "events"."day_shifts"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "day_photos_stamp" BEFORE INSERT OR UPDATE ON "events"."day_photos"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "day_photos_journal_deletion" BEFORE DELETE ON "events"."day_photos"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "day_incidents_stamp" BEFORE INSERT OR UPDATE ON "events"."day_incidents"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "day_incidents_journal_deletion" BEFORE DELETE ON "events"."day_incidents"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "day_checklists_stamp" BEFORE INSERT OR UPDATE ON "events"."day_checklists"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "day_checklists_journal_deletion" BEFORE DELETE ON "events"."day_checklists"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "day_reports_stamp" BEFORE INSERT OR UPDATE ON "events"."day_reports"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "day_reports_journal_deletion" BEFORE DELETE ON "events"."day_reports"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "day_checklist_items_stamp" BEFORE INSERT OR UPDATE ON "events"."day_checklist_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "day_checklist_items_journal_deletion" BEFORE DELETE ON "events"."day_checklist_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "day_checklist_templates_stamp" BEFORE INSERT OR UPDATE ON "events"."day_checklist_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "day_checklist_templates_journal_deletion" BEFORE DELETE ON "events"."day_checklist_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
