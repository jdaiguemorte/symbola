-- Annulation de 0077 (lot 16, PRE-14, ADR 0040) : familles de types de
-- prestataires. Les types gardent leurs fiches ; ils perdent seulement leur
-- famille, et le carnet revient à une pastille par type.
DROP INDEX IF EXISTS "vendors"."vendor_types_family_id_idx";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" DROP CONSTRAINT IF EXISTS "vendor_types_family_id_vendor_families_id_fk";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" DROP COLUMN IF EXISTS "family_id";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" DROP COLUMN IF EXISTS "starter_key";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" DROP COLUMN IF EXISTS "families_seeded_at";
--> statement-breakpoint
DROP TABLE "vendors"."vendor_families";
