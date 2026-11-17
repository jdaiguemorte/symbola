-- Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) : suppression logique dans le schéma events. Une
-- ligne marquée (deleted_at) est cachée par une politique restrictive, sauf quand la transaction
-- voit la corbeille (app.include_deleted) ; le contenu d'un évènement supprimé est caché avec lui.
ALTER TABLE "events"."event_documents" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."event_documents" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."event_places" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_task_comments" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."event_task_comments" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."event_tasks" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."events" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_items" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."program_items" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."program_templates" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."program_templates" ADD COLUMN "deleted_by" uuid;--> statement-breakpoint
ALTER TABLE "events"."task_templates" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events"."task_templates" ADD COLUMN "deleted_by" uuid;
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "events"."events" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "events"."event_tasks" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "events"."program_items" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "events"."event_places" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "events"."event_task_comments" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "events"."event_documents" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "events"."task_templates" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY soft_delete_visibility ON "events"."program_templates" AS RESTRICTIVE
  USING (deleted_at IS NULL OR current_setting('app.include_deleted', true) = 'on');
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_clients" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_clients.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_status_history" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_status_history.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_vendor_slots" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_vendor_slots.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_vendor_candidates" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_vendor_candidates.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_tasks" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_tasks.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."program_items" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = program_items.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."program_versions" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = program_versions.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_links" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_links.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_decisions" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_decisions.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_activities" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_activities.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_places" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_places.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_document_folders" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_document_folders.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_documents" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_documents.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_document_links" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_document_links.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_day_documents" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_day_documents.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_day_contacts" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_day_contacts.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_task_attachments" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_task_attachments.event_id));
--> statement-breakpoint
CREATE POLICY event_visibility ON "events"."event_task_comments" AS RESTRICTIVE
  USING (event_id IS NULL OR EXISTS (SELECT 1 FROM "events"."events" p WHERE p.id = event_task_comments.event_id));
--> statement-breakpoint
CREATE POLICY task_visibility ON "events"."event_task_attachments" AS RESTRICTIVE
  USING (task_id IS NULL OR EXISTS (SELECT 1 FROM "events"."event_tasks" p WHERE p.id = event_task_attachments.task_id));
--> statement-breakpoint
CREATE POLICY task_visibility ON "events"."event_task_comments" AS RESTRICTIVE
  USING (task_id IS NULL OR EXISTS (SELECT 1 FROM "events"."event_tasks" p WHERE p.id = event_task_comments.task_id));
--> statement-breakpoint
CREATE POLICY document_visibility ON "events"."event_document_versions" AS RESTRICTIVE
  USING (document_id IS NULL OR EXISTS (SELECT 1 FROM "events"."event_documents" p WHERE p.id = event_document_versions.document_id));
--> statement-breakpoint
CREATE POLICY document_visibility ON "events"."event_document_links" AS RESTRICTIVE
  USING (document_id IS NULL OR EXISTS (SELECT 1 FROM "events"."event_documents" p WHERE p.id = event_document_links.document_id));
