-- Annulation de 0140 (lot 37b) : tailles des documents signés et des dossiers de preuve (relues au
-- stockage au prochain relevé si la migration est rejouée).
ALTER TABLE "quotes"."contract_evidence" DROP COLUMN IF EXISTS "size_bytes";
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP COLUMN IF EXISTS "signed_document_size_bytes";
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP COLUMN IF EXISTS "audit_certificate_size_bytes";
