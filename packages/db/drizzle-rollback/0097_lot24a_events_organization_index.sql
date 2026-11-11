-- Annulation de 0097 (lot 24a, DAT-01) : index sur organization_id du schéma events.
-- Aucune donnée touchée.
DROP INDEX IF EXISTS "events"."default_vendor_slots_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_activities_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_client_accesses_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_clients_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_places_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_status_history_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_tasks_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_vendor_candidate_notes_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_vendor_candidates_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."event_vendor_slots_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."events_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."loss_reasons_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."program_item_participants_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."program_items_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."program_template_items_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."program_templates_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."prospect_sources_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."task_template_items_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "events"."task_templates_organization_idx";
