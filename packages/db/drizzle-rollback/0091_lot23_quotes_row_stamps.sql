-- Annulation de 0091 (lot 23, DAT-06, ADR 0060) : retire les déclencheurs du schéma
-- quotes et les colonnes d'auteur et de dates ajoutées par le lot 23 (les
-- auteurs enregistrés depuis sont perdus ; lancer après une sauvegarde).
DROP TRIGGER IF EXISTS "catalog_items_stamp" ON "quotes"."catalog_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "catalog_items_journal_deletion" ON "quotes"."catalog_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "credit_notes_stamp" ON "quotes"."credit_notes";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "credit_notes_journal_deletion" ON "quotes"."credit_notes";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "invoices_stamp" ON "quotes"."invoices";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "invoices_journal_deletion" ON "quotes"."invoices";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "payment_methods_stamp" ON "quotes"."payment_methods";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "payment_methods_journal_deletion" ON "quotes"."payment_methods";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "payment_schedule_items_stamp" ON "quotes"."payment_schedule_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "payment_schedule_items_journal_deletion" ON "quotes"."payment_schedule_items";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "quote_lines_stamp" ON "quotes"."quote_lines";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "quote_lines_journal_deletion" ON "quotes"."quote_lines";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "quote_settings_stamp" ON "quotes"."quote_settings";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "quote_settings_journal_deletion" ON "quotes"."quote_settings";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "quote_signers_stamp" ON "quotes"."quote_signers";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "quote_signers_journal_deletion" ON "quotes"."quote_signers";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "quote_versions_stamp" ON "quotes"."quote_versions";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "quote_versions_journal_deletion" ON "quotes"."quote_versions";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "quotes_stamp" ON "quotes"."quotes";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "quotes_journal_deletion" ON "quotes"."quotes";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "signature_requests_stamp" ON "quotes"."signature_requests";
--> statement-breakpoint
DROP TRIGGER IF EXISTS "signature_requests_journal_deletion" ON "quotes"."signature_requests";
--> statement-breakpoint
ALTER TABLE "quotes"."catalog_items" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."catalog_items" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "quotes"."catalog_items" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "quotes"."credit_notes" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."invoices" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."payment_methods" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."payment_methods" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "quotes"."payment_methods" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "quotes"."payment_schedule_items" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "quotes"."payment_schedule_items" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."payment_schedule_items" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "quotes"."payment_schedule_items" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" DROP COLUMN IF EXISTS "created_at";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."quotes" DROP COLUMN IF EXISTS "updated_by";
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP COLUMN IF EXISTS "updated_at";
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP COLUMN IF EXISTS "updated_by";
