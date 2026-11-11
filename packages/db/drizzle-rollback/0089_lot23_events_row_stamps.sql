-- Annulation de 0089 (lot 23, DAT-06, ADR 0060) : retire les déclencheurs du schéma
-- events et les colonnes d'auteur et de dates ajoutées par le lot 23 (les
-- auteurs enregistrés depuis sont perdus ; lancer après une sauvegarde).
DROP TRIGGER IF EXISTS "default_vendor_slots_stamp" ON "events"."default_vendor_slots";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "default_vendor_slots_journal_deletion" ON "events"."default_vendor_slots";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_activities_stamp" ON "events"."event_activities";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_activities_journal_deletion" ON "events"."event_activities";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_client_accesses_stamp" ON "events"."event_client_accesses";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_client_accesses_journal_deletion" ON "events"."event_client_accesses";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_clients_stamp" ON "events"."event_clients";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_clients_journal_deletion" ON "events"."event_clients";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_places_stamp" ON "events"."event_places";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_places_journal_deletion" ON "events"."event_places";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_status_history_stamp" ON "events"."event_status_history";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_status_history_journal_deletion" ON "events"."event_status_history";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_tasks_stamp" ON "events"."event_tasks";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_tasks_journal_deletion" ON "events"."event_tasks";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_types_stamp" ON "events"."event_types";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_types_journal_deletion" ON "events"."event_types";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_vendor_candidate_notes_stamp" ON "events"."event_vendor_candidate_notes";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_vendor_candidate_notes_journal_deletion" ON "events"."event_vendor_candidate_notes";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_vendor_candidates_stamp" ON "events"."event_vendor_candidates";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_vendor_candidates_journal_deletion" ON "events"."event_vendor_candidates";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_vendor_slots_stamp" ON "events"."event_vendor_slots";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "event_vendor_slots_journal_deletion" ON "events"."event_vendor_slots";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "events_stamp" ON "events"."events";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "events_journal_deletion" ON "events"."events";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "loss_reasons_stamp" ON "events"."loss_reasons";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "loss_reasons_journal_deletion" ON "events"."loss_reasons";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "program_item_participants_stamp" ON "events"."program_item_participants";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "program_item_participants_journal_deletion" ON "events"."program_item_participants";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "program_items_stamp" ON "events"."program_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "program_items_journal_deletion" ON "events"."program_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "program_template_items_stamp" ON "events"."program_template_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "program_template_items_journal_deletion" ON "events"."program_template_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "program_templates_stamp" ON "events"."program_templates";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "program_templates_journal_deletion" ON "events"."program_templates";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "prospect_sources_stamp" ON "events"."prospect_sources";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "prospect_sources_journal_deletion" ON "events"."prospect_sources";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "task_template_items_stamp" ON "events"."task_template_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "task_template_items_journal_deletion" ON "events"."task_template_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "task_templates_stamp" ON "events"."task_templates";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "task_templates_journal_deletion" ON "events"."task_templates";
--> statement-breakpoint
ALTER TABLE "events"."default_vendor_slots" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."default_vendor_slots" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."default_vendor_slots" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."event_activities" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."event_client_accesses" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."event_client_accesses" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."event_client_accesses" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."event_clients" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."event_status_history" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."event_types" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."event_types" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."event_types" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidate_notes" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidate_notes" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidate_notes" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_candidates" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."event_vendor_slots" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."loss_reasons" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."loss_reasons" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."loss_reasons" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."program_item_participants" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."program_items" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."program_items" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."program_template_items" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "events"."program_template_items" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."program_template_items" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."program_template_items" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."program_templates" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."program_templates" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."program_templates" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."prospect_sources" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."prospect_sources" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."prospect_sources" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."task_template_items" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "events"."task_template_items" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."task_template_items" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."task_template_items" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "events"."task_templates" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "events"."task_templates" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "events"."task_templates" DROP COLUMN IF EXISTS "updated_by";
