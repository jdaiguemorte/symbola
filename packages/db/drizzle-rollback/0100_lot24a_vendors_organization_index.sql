-- Annulation de 0100 (lot 24a, DAT-01) : index sur organization_id du schéma vendors.
-- Aucune donnée touchée.
DROP INDEX IF EXISTS "vendors"."vendor_files_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "vendors"."vendor_tag_groups_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "vendors"."vendor_tags_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "vendors"."vendor_type_fields_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "vendors"."vendor_types_organization_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "vendors"."vendors_organization_idx";
