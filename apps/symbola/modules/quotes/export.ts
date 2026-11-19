// Lot 35a (HUB-13, DAT-13, ADR 0068) — entités du module Devis et factures dans l'export
// complet de l'organisation (contrat export/v1), dans l'ordre de leurs dépendances : réglages,
// catalogue et modèles, puis chaque devis (versions, lignes, échéancier, contrat, signature),
// les pièces émises (factures, avoirs, reçus, encaissements), leurs originaux et la chaîne des
// pièces. Les pièces d'essai (série DEMO) et ce qui en dépend sont exclus. Exposé par service.ts.
import type { ExportEntitySchema, ModuleExport, ModuleExportContext } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { describeModuleEntities, exportModuleEntities, type ExportEntitySpec } from "@symbola/db/export";
import {
  catalogItems,
  contractEvidence,
  contracts,
  contractSignerActs,
  contractTemplateAcceptances,
  contractTemplateClauses,
  contractTemplates,
  creditNotes,
  earnestReceipts,
  invoices,
  ledgerEntries,
  numberSeries,
  originalDocuments,
  paymentEntries,
  paymentMethods,
  paymentScheduleItems,
  quoteLines,
  quotes,
  quoteSections,
  quoteSettings,
  quoteSigners,
  quoteTemplateLines,
  quoteTemplates,
  quoteTemplateScheduleItems,
  quoteTemplateSections,
  quoteVersions,
  scheduledDepositInvoices,
  signatureRequests,
  paymentReferences,
  paymentReminders,
  proposalTemplates,
  plannerFees,
  vendorCommissions,
} from "@symbola/db/schema/quotes";

import { openQuoteSettings } from "./bank-details";

// Original d'une pièce : celle d'une facture ou d'un avoir (lot 23b).
const ORIGINAL_PARENTS: Record<string, string> = { invoice: "invoices", credit_note: "credit_notes" };

export const QUOTES_EXPORT_ENTITIES: readonly ExportEntitySpec[] = [
  // Lot 48a (DAT-08) : l'IBAN et le BIC de la planner sortent en clair dans leurs champs d'origine
  // (contrat export/v1 inchangé) ; leurs colonnes chiffrées n'en sortent pas.
  { table: quoteSettings, omit: ["ibanSealed", "bicSealed"], transform: (row) => openQuoteSettings(row as Parameters<typeof openQuoteSettings>[0]) },
  { table: numberSeries, demoField: "isDemo" },
  { table: paymentMethods },
  { table: catalogItems },
  { table: contractTemplates },
  { table: contractTemplateClauses, parents: { templateId: "contract_templates" } },
  { table: contractTemplateAcceptances, parents: { templateId: "contract_templates" } },
  { table: quoteTemplates },
  { table: quoteTemplateSections, parents: { templateId: "quote_templates" } },
  { table: quoteTemplateLines, parents: { templateId: "quote_templates" } },
  { table: quoteTemplateScheduleItems, parents: { templateId: "quote_templates" } },
  // Lot 43 (FAC-02, D2) : modèles de la page de proposition (photos dans le stockage privé).
  { table: proposalTemplates },
  { table: quotes, demoField: "isDemo", eventField: "eventId" },
  // Lot 48b (BUD-08, PRE-07) : honoraires et commissions par évènement (avant les factures qui les citent).
  { table: plannerFees, eventField: "eventId" },
  { table: vendorCommissions, eventField: "eventId" },
  { table: quoteVersions, parents: { quoteId: "quotes" } },
  { table: quoteSections, parents: { versionId: "quote_versions" } },
  { table: quoteLines, parents: { versionId: "quote_versions" } },
  { table: paymentScheduleItems, parents: { versionId: "quote_versions" } },
  { table: contracts, parents: { quoteId: "quotes", quoteVersionId: "quote_versions" } },
  { table: contractSignerActs, parents: { contractId: "contracts" } },
  { table: signatureRequests, parents: { versionId: "quote_versions", contractId: "contracts" }, files: ["signedDocumentKey", "auditCertificateKey"] },
  // Le lien de signature chez le fournisseur ne sort pas : il donne accès au document à signer.
  { table: quoteSigners, parents: { requestId: "signature_requests" }, omit: ["signingUrl"] },
  { table: contractEvidence, parents: { requestId: "signature_requests", contractId: "contracts" }, files: ["documentKey"] },
  { table: invoices, demoField: "isDemo", parents: { quoteId: "quotes" } },
  { table: scheduledDepositInvoices, parents: { quoteId: "quotes" } },
  { table: creditNotes, demoField: "isDemo", parents: { invoiceId: "invoices" } },
  { table: paymentEntries, demoField: "isDemo", parents: { scheduleItemId: "payment_schedule_items" } },
  { table: earnestReceipts, demoField: "isDemo", parents: { quoteId: "quotes" } },
  // Lot 43 (FAC-08, FAC-09) : référence de virement et déclaration du payeur, relances envoyées.
  { table: paymentReferences, demoField: "isDemo", parents: { scheduleItemId: "payment_schedule_items" } },
  { table: paymentReminders, parents: { scheduleItemId: "payment_schedule_items" } },
  {
    table: originalDocuments,
    parents: (row) => {
      const entity = ORIGINAL_PARENTS[String(row.documentKind)];
      return entity ? [[entity, row.documentId]] : [];
    },
    files: ["storageKey"],
  },
  // La chaîne des pièces (FAC-14) ne porte jamais de pièce d'essai.
  { table: ledgerEntries },
];

// Tables du module qui ne sont pas exportées, et pourquoi (docs/export/format-v1.md).
export const QUOTES_EXPORT_EXCLUSIONS: Readonly<Record<string, string>> = {
  signature_webhook_log: "technique : notifications reçues du fournisseur de signature",
};

export function exportQuotesData(organizationId: string, context: ModuleExportContext): Promise<ModuleExport> {
  return exportModuleEntities(appDatabase(), { organizationId, module: "quotes", context, specs: QUOTES_EXPORT_ENTITIES });
}

export function describeQuotesExport(): ExportEntitySchema[] {
  return describeModuleEntities("quotes", QUOTES_EXPORT_ENTITIES);
}
