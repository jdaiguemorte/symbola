-- Annulation de 0096 (lot 24a, DAT-01) : index sur organization_id du schéma hub.
-- Aucune donnée touchée.
DROP INDEX IF EXISTS "hub"."import_items_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."import_jobs_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."imports_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."invitations_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."privacy_erasures_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."privacy_exports_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."privacy_purges_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."privacy_requests_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."users_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "hub"."vat_regime_changes_organization_idx";
