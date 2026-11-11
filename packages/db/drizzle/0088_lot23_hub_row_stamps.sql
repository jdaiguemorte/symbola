ALTER TABLE "hub"."import_items" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."import_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."import_items" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."import_jobs" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."import_jobs" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."imports" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."imports" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."invitations" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."invitations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."invitations" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."organization_modules" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."organization_modules" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."organization_modules" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."organizations" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."privacy_erasures" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."privacy_exports" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."privacy_exports" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."privacy_exports" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."privacy_purges" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."privacy_requests" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."privacy_requests" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hub"."users" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "hub"."vat_regime_changes" ADD COLUMN "created_by" uuid;
--> statement-breakpoint
-- Lot 23 (DAT-06, SEC-19, ADR 0060) : auteur et dates sur chaque ligne du schéma
-- hub (core.stamp_row, ou core.stamp_created_row pour une table en ajout
-- seul) et suppressions journalisées (core.journal_deletion). Une ligne
-- existante prend pour date de modification sa date de création ; son auteur
-- reste inconnu (vide). Tables techniques exclues : packages/db/src/row-stamps.ts.
--> statement-breakpoint
UPDATE "hub"."import_items" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "import_items_stamp" BEFORE INSERT OR UPDATE ON "hub"."import_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "import_items_journal_deletion" BEFORE DELETE ON "hub"."import_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "import_jobs_stamp" BEFORE INSERT OR UPDATE ON "hub"."import_jobs"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "import_jobs_journal_deletion" BEFORE DELETE ON "hub"."import_jobs"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "imports_stamp" BEFORE INSERT OR UPDATE ON "hub"."imports"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "imports_journal_deletion" BEFORE DELETE ON "hub"."imports"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "hub"."invitations" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "invitations_stamp" BEFORE INSERT OR UPDATE ON "hub"."invitations"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "invitations_journal_deletion" BEFORE DELETE ON "hub"."invitations"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "organization_modules_stamp" BEFORE INSERT OR UPDATE ON "hub"."organization_modules"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "organization_modules_journal_deletion" BEFORE DELETE ON "hub"."organization_modules"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "organization_profiles_stamp" BEFORE INSERT OR UPDATE ON "hub"."organization_profiles"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "organization_profiles_journal_deletion" BEFORE DELETE ON "hub"."organization_profiles"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "hub"."organizations" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "organizations_stamp" BEFORE INSERT OR UPDATE ON "hub"."organizations"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "platform_settings_stamp" BEFORE INSERT OR UPDATE ON "hub"."platform_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "privacy_erasures_stamp" BEFORE INSERT OR UPDATE ON "hub"."privacy_erasures"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "privacy_erasures_journal_deletion" BEFORE DELETE ON "hub"."privacy_erasures"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "hub"."privacy_exports" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "privacy_exports_stamp" BEFORE INSERT OR UPDATE ON "hub"."privacy_exports"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "privacy_exports_journal_deletion" BEFORE DELETE ON "hub"."privacy_exports"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "privacy_purges_stamp" BEFORE INSERT OR UPDATE ON "hub"."privacy_purges"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "privacy_purges_journal_deletion" BEFORE DELETE ON "hub"."privacy_purges"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "privacy_requests_stamp" BEFORE INSERT OR UPDATE ON "hub"."privacy_requests"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "privacy_requests_journal_deletion" BEFORE DELETE ON "hub"."privacy_requests"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "privacy_settings_stamp" BEFORE INSERT OR UPDATE ON "hub"."privacy_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "privacy_settings_journal_deletion" BEFORE DELETE ON "hub"."privacy_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "hub"."users" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "users_stamp" BEFORE INSERT OR UPDATE ON "hub"."users"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "users_journal_deletion" BEFORE DELETE ON "hub"."users"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "vat_regime_changes_stamp" BEFORE INSERT OR UPDATE ON "hub"."vat_regime_changes"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "vat_regime_changes_journal_deletion" BEFORE DELETE ON "hub"."vat_regime_changes"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
