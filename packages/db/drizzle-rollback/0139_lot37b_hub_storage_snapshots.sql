-- Annulation de 0139 (lot 37b) : relevés de stockage et taille du logo. Les relevés sont perdus.
DROP TABLE IF EXISTS "hub"."storage_snapshots";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "logo_size_bytes";
