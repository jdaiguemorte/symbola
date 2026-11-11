-- Annulation de 0088 (lot 23, DAT-06, ADR 0060) : retire les déclencheurs du schéma
-- hub et les colonnes d'auteur et de dates ajoutées par le lot 23 (les
-- auteurs enregistrés depuis sont perdus ; lancer après une sauvegarde).
DROP TRIGGER IF EXISTS "import_items_stamp" ON "hub"."import_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "import_items_journal_deletion" ON "hub"."import_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "import_jobs_stamp" ON "hub"."import_jobs";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "import_jobs_journal_deletion" ON "hub"."import_jobs";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "imports_stamp" ON "hub"."imports";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "imports_journal_deletion" ON "hub"."imports";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "invitations_stamp" ON "hub"."invitations";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "invitations_journal_deletion" ON "hub"."invitations";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "organization_modules_stamp" ON "hub"."organization_modules";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "organization_modules_journal_deletion" ON "hub"."organization_modules";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "organization_profiles_stamp" ON "hub"."organization_profiles";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "organization_profiles_journal_deletion" ON "hub"."organization_profiles";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "organizations_stamp" ON "hub"."organizations";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "organizations_journal_deletion" ON "hub"."organizations";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "platform_settings_stamp" ON "hub"."platform_settings";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "platform_settings_journal_deletion" ON "hub"."platform_settings";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "privacy_erasures_stamp" ON "hub"."privacy_erasures";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "privacy_erasures_journal_deletion" ON "hub"."privacy_erasures";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "privacy_exports_stamp" ON "hub"."privacy_exports";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "privacy_exports_journal_deletion" ON "hub"."privacy_exports";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "privacy_purges_stamp" ON "hub"."privacy_purges";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "privacy_purges_journal_deletion" ON "hub"."privacy_purges";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "privacy_requests_stamp" ON "hub"."privacy_requests";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "privacy_requests_journal_deletion" ON "hub"."privacy_requests";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "privacy_settings_stamp" ON "hub"."privacy_settings";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "privacy_settings_journal_deletion" ON "hub"."privacy_settings";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "users_stamp" ON "hub"."users";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "users_journal_deletion" ON "hub"."users";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vat_regime_changes_stamp" ON "hub"."vat_regime_changes";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "vat_regime_changes_journal_deletion" ON "hub"."vat_regime_changes";
--> statement-breakpoint
ALTER TABLE "hub"."import_items" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."import_items" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "hub"."import_items" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."import_jobs" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."import_jobs" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."imports" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."imports" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."invitations" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."invitations" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "hub"."invitations" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."organization_modules" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "hub"."organization_modules" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."organization_modules" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."organization_profiles" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "hub"."organizations" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."platform_settings" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_erasures" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_exports" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_exports" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_exports" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_purges" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_requests" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_requests" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."privacy_settings" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "hub"."users" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "hub"."vat_regime_changes" DROP COLUMN IF EXISTS "created_by";
