ALTER TABLE "quotes"."catalog_items" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."catalog_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."catalog_items" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."credit_notes" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."invoices" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."payment_methods" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."payment_methods" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."payment_methods" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."payment_schedule_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."payment_schedule_items" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."payment_schedule_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."payment_schedule_items" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_lines" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_signers" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."quote_versions" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."quotes" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD COLUMN "updated_by" uuid;
--> statement-breakpoint
-- Lot 23 (DAT-06, SEC-19, ADR 0060) : auteur et dates sur chaque ligne du schéma
-- quotes (core.stamp_row, ou core.stamp_created_row pour une table en ajout
-- seul) et suppressions journalisées (core.journal_deletion). Une ligne
-- existante prend pour date de modification sa date de création ; son auteur
-- reste inconnu (vide). Tables techniques exclues : packages/db/src/row-stamps.ts.
--> statement-breakpoint
UPDATE "quotes"."catalog_items" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "catalog_items_stamp" BEFORE INSERT OR UPDATE ON "quotes"."catalog_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "catalog_items_journal_deletion" BEFORE DELETE ON "quotes"."catalog_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "credit_notes_stamp" BEFORE INSERT OR UPDATE ON "quotes"."credit_notes"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "credit_notes_journal_deletion" BEFORE DELETE ON "quotes"."credit_notes"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "invoices_stamp" BEFORE INSERT OR UPDATE ON "quotes"."invoices"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_created_row"();
--> statement-breakpoint
CREATE TRIGGER "invoices_journal_deletion" BEFORE DELETE ON "quotes"."invoices"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "quotes"."payment_methods" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "payment_methods_stamp" BEFORE INSERT OR UPDATE ON "quotes"."payment_methods"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "payment_methods_journal_deletion" BEFORE DELETE ON "quotes"."payment_methods"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "payment_schedule_items_stamp" BEFORE INSERT OR UPDATE ON "quotes"."payment_schedule_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "payment_schedule_items_journal_deletion" BEFORE DELETE ON "quotes"."payment_schedule_items"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "quote_lines_stamp" BEFORE INSERT OR UPDATE ON "quotes"."quote_lines"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "quote_lines_journal_deletion" BEFORE DELETE ON "quotes"."quote_lines"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "quote_settings_stamp" BEFORE INSERT OR UPDATE ON "quotes"."quote_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "quote_settings_journal_deletion" BEFORE DELETE ON "quotes"."quote_settings"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "quote_signers_stamp" BEFORE INSERT OR UPDATE ON "quotes"."quote_signers"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "quote_signers_journal_deletion" BEFORE DELETE ON "quotes"."quote_signers"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "quotes"."quote_versions" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "quote_versions_stamp" BEFORE INSERT OR UPDATE ON "quotes"."quote_versions"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "quote_versions_journal_deletion" BEFORE DELETE ON "quotes"."quote_versions"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
CREATE TRIGGER "quotes_stamp" BEFORE INSERT OR UPDATE ON "quotes"."quotes"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "quotes_journal_deletion" BEFORE DELETE ON "quotes"."quotes"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
--> statement-breakpoint
UPDATE "quotes"."signature_requests" SET "updated_at" = "created_at";
--> statement-breakpoint
CREATE TRIGGER "signature_requests_stamp" BEFORE INSERT OR UPDATE ON "quotes"."signature_requests"
  FOR EACH ROW EXECUTE FUNCTION "core"."stamp_row"();
--> statement-breakpoint
CREATE TRIGGER "signature_requests_journal_deletion" BEFORE DELETE ON "quotes"."signature_requests"
  FOR EACH ROW EXECUTE FUNCTION "core"."journal_deletion"();
