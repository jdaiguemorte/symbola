-- Annulation de 0092 (lot 23, DAT-06, ADR 0060) : retire les déclencheurs du schéma
-- vendors et les colonnes d'auteur et de dates ajoutées par le lot 23 (les
-- auteurs enregistrés depuis sont perdus ; lancer après une sauvegarde).
DROP TRIGGER IF EXISTS "vendor_families_stamp" ON "vendors"."vendor_families";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_families_journal_deletion" ON "vendors"."vendor_families";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_files_stamp" ON "vendors"."vendor_files";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_files_journal_deletion" ON "vendors"."vendor_files";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_settings_stamp" ON "vendors"."vendor_settings";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_settings_journal_deletion" ON "vendors"."vendor_settings";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_tag_groups_stamp" ON "vendors"."vendor_tag_groups";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_tag_groups_journal_deletion" ON "vendors"."vendor_tag_groups";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_tags_stamp" ON "vendors"."vendor_tags";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_tags_journal_deletion" ON "vendors"."vendor_tags";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_type_fields_stamp" ON "vendors"."vendor_type_fields";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_type_fields_journal_deletion" ON "vendors"."vendor_type_fields";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_types_stamp" ON "vendors"."vendor_types";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendor_types_journal_deletion" ON "vendors"."vendor_types";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendors_stamp" ON "vendors"."vendors";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vendors_journal_deletion" ON "vendors"."vendors";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_families" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_families" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_families" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_files" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_files" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_files" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tag_groups" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tag_groups" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tag_groups" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "vendors"."vendors" DROP COLUMN IF EXISTS "updated_by";
