ALTER TABLE "vendors"."vendor_families" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_families" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_families" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_files" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_files" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_files" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_settings" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tag_groups" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tag_groups" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tag_groups" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_tags" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_type_fields" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors"."vendor_types" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors"."vendors" ADD COLUMN "updated_by" uuid;
--> statement-breakpoint
-- Lot 23 (DAT-06, SEC-19, ADR 0060) : auteur et dates sur chaque ligne du schéma
-- vendors (core.stamp_row, ou core.stamp_created_row pour une table en ajout
-- seul) et suppressions journalisées (core.journal_deletion). Une ligne
-- existante prend pour date de modification sa date de création ; son auteur
-- reste inconnu (vide). Tables techniques exclues : packages/db/src/row-stamps.ts.
--> statement-breakpoint
UPDATE "vendors"."vendor_families" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "vendor_families_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_families"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_families_journal_deletion" BEFORE DELETE ON "vendors"."vendor_families"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "vendors"."vendor_files" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "vendor_files_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_files"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_files_journal_deletion" BEFORE DELETE ON "vendors"."vendor_files"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "vendor_settings_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_settings_journal_deletion" BEFORE DELETE ON "vendors"."vendor_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "vendors"."vendor_tag_groups" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "vendor_tag_groups_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_tag_groups"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_tag_groups_journal_deletion" BEFORE DELETE ON "vendors"."vendor_tag_groups"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "vendors"."vendor_tags" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "vendor_tags_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_tags"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_tags_journal_deletion" BEFORE DELETE ON "vendors"."vendor_tags"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "vendors"."vendor_type_fields" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "vendor_type_fields_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_type_fields"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_type_fields_journal_deletion" BEFORE DELETE ON "vendors"."vendor_type_fields"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "vendors"."vendor_types" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "vendor_types_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendor_types"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendor_types_journal_deletion" BEFORE DELETE ON "vendors"."vendor_types"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "vendors_stamp" BEFORE INSERT OR UPDATE ON "vendors"."vendors"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "vendors_journal_deletion" BEFORE DELETE ON "vendors"."vendors"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
