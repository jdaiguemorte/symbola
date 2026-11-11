ALTER TABLE "events"."default_vendor_slots" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."default_vendor_slots" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."default_vendor_slots" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_activities" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_client_accesses" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_client_accesses" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_client_accesses" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_clients" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_status_history" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_types" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_types" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_types" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidate_notes" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidate_notes" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidate_notes" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."loss_reasons" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."loss_reasons" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."loss_reasons" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_items" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_items" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_template_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."program_template_items" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_template_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."program_template_items" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_templates" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_templates" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."program_templates" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."prospect_sources" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."prospect_sources" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."prospect_sources" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."task_template_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."task_template_items" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."task_template_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."task_template_items" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."task_templates" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."task_templates" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "events"."task_templates" ADD COLUMN "updated_by" uuid;
--> statement-breakpoint
-- Lot 23 (DAT-06, SEC-19, ADR 0060) : auteur et dates sur chaque ligne du schéma
-- events (core.stamp_row, ou core.stamp_created_row pour une table en ajout
-- seul) et suppressions journalisées (core.journal_deletion). Une ligne
-- existante prend pour date de modification sa date de création ; son auteur
-- reste inconnu (vide). Tables techniques exclues : packages/db/src/row-stamps.ts.
--> statement-breakpoint
UPDATE "events"."default_vendor_slots" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "default_vendor_slots_stamp" BEFORE INSERT OR UPDATE ON "events"."default_vendor_slots"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "default_vendor_slots_journal_deletion" BEFORE DELETE ON "events"."default_vendor_slots"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_activities_stamp" BEFORE INSERT OR UPDATE ON "events"."event_activities"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "event_activities_journal_deletion" BEFORE DELETE ON "events"."event_activities"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "events"."event_client_accesses" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "event_client_accesses_stamp" BEFORE INSERT OR UPDATE ON "events"."event_client_accesses"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_client_accesses_journal_deletion" BEFORE DELETE ON "events"."event_client_accesses"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "events"."event_clients" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "event_clients_stamp" BEFORE INSERT OR UPDATE ON "events"."event_clients"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_clients_journal_deletion" BEFORE DELETE ON "events"."event_clients"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "events"."event_places" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "event_places_stamp" BEFORE INSERT OR UPDATE ON "events"."event_places"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_places_journal_deletion" BEFORE DELETE ON "events"."event_places"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_status_history_stamp" BEFORE INSERT OR UPDATE ON "events"."event_status_history"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "event_status_history_journal_deletion" BEFORE DELETE ON "events"."event_status_history"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_tasks_stamp" BEFORE INSERT OR UPDATE ON "events"."event_tasks"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_tasks_journal_deletion" BEFORE DELETE ON "events"."event_tasks"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "events"."event_types" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "event_types_stamp" BEFORE INSERT OR UPDATE ON "events"."event_types"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_types_journal_deletion" BEFORE DELETE ON "events"."event_types"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "events"."event_vendor_candidate_notes" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "event_vendor_candidate_notes_stamp" BEFORE INSERT OR UPDATE ON "events"."event_vendor_candidate_notes"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_vendor_candidate_notes_journal_deletion" BEFORE DELETE ON "events"."event_vendor_candidate_notes"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_vendor_candidates_stamp" BEFORE INSERT OR UPDATE ON "events"."event_vendor_candidates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_vendor_candidates_journal_deletion" BEFORE DELETE ON "events"."event_vendor_candidates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "event_vendor_slots_stamp" BEFORE INSERT OR UPDATE ON "events"."event_vendor_slots"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "event_vendor_slots_journal_deletion" BEFORE DELETE ON "events"."event_vendor_slots"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "events_stamp" BEFORE INSERT OR UPDATE ON "events"."events"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "events_journal_deletion" BEFORE DELETE ON "events"."events"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "events"."loss_reasons" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "loss_reasons_stamp" BEFORE INSERT OR UPDATE ON "events"."loss_reasons"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "loss_reasons_journal_deletion" BEFORE DELETE ON "events"."loss_reasons"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "program_item_participants_stamp" BEFORE INSERT OR UPDATE ON "events"."program_item_participants"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "program_item_participants_journal_deletion" BEFORE DELETE ON "events"."program_item_participants"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "program_items_stamp" BEFORE INSERT OR UPDATE ON "events"."program_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "program_items_journal_deletion" BEFORE DELETE ON "events"."program_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "program_template_items_stamp" BEFORE INSERT OR UPDATE ON "events"."program_template_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "program_template_items_journal_deletion" BEFORE DELETE ON "events"."program_template_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "events"."program_templates" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "program_templates_stamp" BEFORE INSERT OR UPDATE ON "events"."program_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "program_templates_journal_deletion" BEFORE DELETE ON "events"."program_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "events"."prospect_sources" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "prospect_sources_stamp" BEFORE INSERT OR UPDATE ON "events"."prospect_sources"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "prospect_sources_journal_deletion" BEFORE DELETE ON "events"."prospect_sources"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "task_template_items_stamp" BEFORE INSERT OR UPDATE ON "events"."task_template_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "task_template_items_journal_deletion" BEFORE DELETE ON "events"."task_template_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "events"."task_templates" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "task_templates_stamp" BEFORE INSERT OR UPDATE ON "events"."task_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "task_templates_journal_deletion" BEFORE DELETE ON "events"."task_templates"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
