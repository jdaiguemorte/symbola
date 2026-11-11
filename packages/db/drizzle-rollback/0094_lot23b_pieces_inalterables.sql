-- Annulation de 0094 (lot 23b, ADR 0061) : chaîne d'empreintes, originaux et
-- écritures d'encaissement. Les écritures, les originaux enregistrés (le
-- fichier reste dans le stockage) et l'historique des annulations sont perdus ;
-- l'échéance garde sa copie de lecture (payée ou non). Après une sauvegarde.
-- Les fonctions qui prennent une ligne de ces tables partent avant elles.
DROP TRIGGER IF EXISTS invoices_chain ON "quotes"."invoices";
--> statement-breakpoint
DROP TRIGGER IF EXISTS credit_notes_chain ON "quotes"."credit_notes";
--> statement-breakpoint
DROP TABLE "quotes"."ledger_entries";
--> statement-breakpoint
DROP TRIGGER IF EXISTS original_documents_chain ON "quotes"."original_documents";
--> statement-breakpoint
DROP TRIGGER IF EXISTS payment_entries_chain ON "quotes"."payment_entries";
--> statement-breakpoint
DROP FUNCTION "quotes"."chain_new_piece"();
--> statement-breakpoint
DROP FUNCTION "quotes"."verify_ledger"(uuid);
--> statement-breakpoint
DROP FUNCTION "quotes"."chain_piece"(uuid, text, uuid, jsonb, boolean);
--> statement-breakpoint
DROP FUNCTION "quotes"."chain_ledger_entry"();
--> statement-breakpoint
DROP FUNCTION "quotes"."ledger_payload_original"("quotes"."original_documents");
--> statement-breakpoint
DROP FUNCTION "quotes"."ledger_payload_payment"("quotes"."payment_entries");
--> statement-breakpoint
DROP TABLE "quotes"."original_documents";
--> statement-breakpoint
DROP TABLE "quotes"."payment_entries";
--> statement-breakpoint
DROP FUNCTION "quotes"."ledger_hash"(text, bigint, text, uuid, jsonb);
--> statement-breakpoint
DROP FUNCTION "quotes"."ledger_payload_invoice"("quotes"."invoices");
--> statement-breakpoint
DROP FUNCTION "quotes"."ledger_payload_credit_note"("quotes"."credit_notes");
--> statement-breakpoint
DROP FUNCTION "quotes"."ledger_utc"(timestamptz);
--> statement-breakpoint
DROP FUNCTION "quotes"."ledger_sha256"(text);
--> statement-breakpoint
DROP FUNCTION "quotes"."forbid_payment_entry_change"();
--> statement-breakpoint
DROP FUNCTION "quotes"."forbid_ledger_change"();
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP COLUMN IF EXISTS "signed_document_sha256";
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP COLUMN IF EXISTS "audit_certificate_sha256";
