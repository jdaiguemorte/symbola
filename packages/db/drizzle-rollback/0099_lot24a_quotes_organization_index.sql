-- Annulation de 0099 (lot 24a, DAT-01) : index sur organization_id du schéma quotes.
-- Aucune donnée touchée.
DROP INDEX IF EXISTS "quotes"."catalog_items_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "quotes"."original_documents_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "quotes"."payment_entries_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "quotes"."payment_methods_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "quotes"."payment_schedule_items_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "quotes"."quote_lines_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "quotes"."quote_signers_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "quotes"."quote_versions_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "quotes"."signature_requests_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "quotes"."signature_webhook_log_organization_idx";
