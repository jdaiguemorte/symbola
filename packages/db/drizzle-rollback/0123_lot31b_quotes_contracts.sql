-- Annulation de 0123 (lot 31b) : modèles de contrat, acceptations de l'avertissement, contrats
-- générés, actes des signataires, dossiers de preuve et factures d'acompte à émettre sont perdus
-- (les fichiers des dossiers de preuve restent dans le stockage) ; les demandes de signature du
-- contrat seul sont retirées, celles du devis et de son contrat redeviennent des demandes du devis
-- (le document signé reste archivé). Les factures déjà émises restent. Le réglage « acompte » par
-- défaut reste choisi.
DROP TABLE "quotes"."scheduled_deposit_invoices";
--> statement-breakpoint
DROP TABLE "quotes"."contract_evidence";
--> statement-breakpoint
DROP TABLE "quotes"."contract_signer_acts";
--> statement-breakpoint
DELETE FROM "quotes"."signature_webhook_log" WHERE "request_id" IN (SELECT "id" FROM "quotes"."signature_requests" WHERE "kind" = 'contract');
--> statement-breakpoint
DELETE FROM "quotes"."quote_signers" WHERE "request_id" IN (SELECT "id" FROM "quotes"."signature_requests" WHERE "kind" = 'contract');
--> statement-breakpoint
DELETE FROM "quotes"."signature_requests" WHERE "kind" = 'contract';
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP CONSTRAINT "signature_requests_kind_check";
--> statement-breakpoint
DROP INDEX "quotes"."signature_requests_contract_unique";
--> statement-breakpoint
DROP INDEX "quotes"."signature_requests_quote_version_unique";
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP CONSTRAINT "signature_requests_contract_id_contracts_id_fk";
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP COLUMN "contract_id";
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" DROP COLUMN "kind";
--> statement-breakpoint
ALTER TABLE "quotes"."signature_requests" ADD CONSTRAINT "signature_requests_version_id_unique" UNIQUE("version_id");
--> statement-breakpoint
DROP TABLE "quotes"."contract_template_acceptances";
--> statement-breakpoint
DROP TABLE "quotes"."contracts";
--> statement-breakpoint
DROP TABLE "quotes"."contract_template_clauses";
--> statement-breakpoint
DROP TABLE "quotes"."contract_templates";
--> statement-breakpoint
ALTER TABLE "quotes"."quote_settings" ALTER COLUMN "advance_kind_default" DROP DEFAULT;
--> statement-breakpoint
DROP TYPE "quotes"."signature_request_kind";
--> statement-breakpoint
DROP TYPE "quotes"."conclusion_channel";
--> statement-breakpoint
DROP TYPE "quotes"."contract_clause_role";
