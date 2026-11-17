-- Annulation de 0144 (lot 39a) : la suppression logique du schéma events disparaît. Refusée tant
-- qu'une ligne est à la corbeille : elle redeviendrait visible sans que personne l'ait restaurée.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "events"."events" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de events.events sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_tasks" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de events.event_tasks sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."program_items" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de events.program_items sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_places" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de events.event_places sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_task_comments" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de events.event_task_comments sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."event_documents" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de events.event_documents sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."task_templates" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de events.task_templates sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
  IF EXISTS (SELECT 1 FROM "events"."program_templates" WHERE deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Annulation refusée : des lignes de events.program_templates sont à la corbeille (restaurez-les ou attendez la purge).';
  END IF;
END $$;
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_clients";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_status_history";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_vendor_slots";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_vendor_candidates";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_tasks";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."program_items";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."program_versions";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_links";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_decisions";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_activities";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_places";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_document_folders";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_documents";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_document_links";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_day_documents";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_day_contacts";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_task_attachments";
--> statement-breakpoint
DROP POLICY IF EXISTS event_visibility ON "events"."event_task_comments";
--> statement-breakpoint
DROP POLICY IF EXISTS task_visibility ON "events"."event_task_attachments";
--> statement-breakpoint
DROP POLICY IF EXISTS task_visibility ON "events"."event_task_comments";
--> statement-breakpoint
DROP POLICY IF EXISTS document_visibility ON "events"."event_document_versions";
--> statement-breakpoint
DROP POLICY IF EXISTS document_visibility ON "events"."event_document_links";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "events"."events";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "events"."events" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "events"."event_tasks";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "events"."event_tasks" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "events"."program_items";
--> statement-breakpoint
ALTER TABLE "events"."program_items" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "events"."program_items" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "events"."event_places";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "events"."event_places" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "events"."event_task_comments";
--> statement-breakpoint
ALTER TABLE "events"."event_task_comments" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "events"."event_task_comments" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "events"."event_documents";
--> statement-breakpoint
ALTER TABLE "events"."event_documents" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "events"."event_documents" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "events"."task_templates";
--> statement-breakpoint
ALTER TABLE "events"."task_templates" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "events"."task_templates" DROP COLUMN IF EXISTS "deleted_at";
--> statement-breakpoint
DROP POLICY IF EXISTS soft_delete_visibility ON "events"."program_templates";
--> statement-breakpoint
ALTER TABLE "events"."program_templates" DROP COLUMN IF EXISTS "deleted_by";
--> statement-breakpoint
ALTER TABLE "events"."program_templates" DROP COLUMN IF EXISTS "deleted_at";
