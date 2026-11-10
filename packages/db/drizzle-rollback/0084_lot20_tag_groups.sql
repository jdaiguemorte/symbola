-- Annulation de 0084 (lot 20, décision 5, ADR 0049) : groupes d'étiquettes.
-- Les étiquettes et leur présence sur les fiches restent ; elles perdent
-- seulement leur groupe, leurs familles et leur ordre, et redeviennent une
-- seule liste valable pour tous les prestataires.
DROP INDEX IF EXISTS "vendors"."vendor_tags_group_id_idx";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" DROP CONSTRAINT IF EXISTS "vendor_tags_group_id_vendor_tag_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" DROP COLUMN IF EXISTS "group_id";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" DROP COLUMN IF EXISTS "family_ids";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" DROP COLUMN IF EXISTS "position";
--> statement-breakpoint
DROP TABLE "vendors"."vendor_tag_groups";
