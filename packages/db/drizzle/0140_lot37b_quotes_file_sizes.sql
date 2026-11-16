-- Lot 37b (DOC-12, D13 ; ADR 0071) : taille des documents signés, des certificats de signature et
-- des dossiers de preuve, pour le relevé de stockage. Nulle pour l'existant : le premier relevé la
-- lit une fois au stockage et la garde. Schéma quotes seulement ; compatible avec l'image du lot 37a.
ALTER TABLE "quotes"."contract_evidence" ADD COLUMN "size_bytes" integer;--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD COLUMN "signed_document_size_bytes" integer;--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD COLUMN "audit_certificate_size_bytes" integer;
