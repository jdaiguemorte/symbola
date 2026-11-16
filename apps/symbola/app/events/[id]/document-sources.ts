// Lot 37a (DOC-01, D2, D3 ; ADR 0070) — pièces produites par les modules pour l'espace documents
// d'un évènement, en lecture, dans les dossiers fixes des modules. Chaque module les fournit par
// son service.ts (ADR 0011) et reste seul à les gérer ; un module non souscrit n'en montre aucune
// (dégradation propre). Les routes servent chaque fichier après contrôle des droits (ADR 0027),
// à afficher avec « ?apercu=1 » (lib/file-response.ts). Les originaux légaux (factures, avoirs,
// documents signés) sont ceux de l'émission, jamais reconstruits (DOC-08) ; le devis en cours
// est rendu à la demande depuis les données de sa version (DOC-07).
import { getTranslations } from "next-intl/server";
import { listEventTaskAttachments, listEventTasks, listVendorCandidates } from "@/modules/events/service";
import { listEventInvoices, listEventQuotes } from "@/modules/quotes/service";
import { listBudgetLines } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";

export type ModuleDocument = {
  key: string;
  label: string;
  // Nature ou précision (« Version 2 », « Tâche : Choisir le traiteur »).
  detail: string | null;
  mime: string | null;
  sizeBytes: number | null;
  // Route du fichier ; l'aperçu y ajoute « ?apercu=1 ».
  path: string;
};

export type ModuleFolderKey = "quotes" | "invoices" | "tasks" | "budget" | "candidates";
export type ModuleFolder = { key: ModuleFolderKey; title: string; documents: ModuleDocument[] };

export async function listModuleDocumentFolders(organizationId: string, eventId: string): Promise<ModuleFolder[]> {
  const t = await getTranslations("EventDocuments");
  const tBudget = await getTranslations("Budget");
  const [quotesEnabled, budgetEnabled] = await Promise.all([isQuotesModuleEnabled(organizationId), isBudgetModuleEnabled(organizationId)]);
  const [quotes, invoices, attachments, tasks, candidates, budget] = await Promise.all([
    quotesEnabled ? listEventQuotes(organizationId, eventId) : Promise.resolve([]),
    quotesEnabled ? listEventInvoices(organizationId, eventId) : Promise.resolve([]),
    listEventTaskAttachments(organizationId, eventId),
    listEventTasks(organizationId, eventId),
    listVendorCandidates(organizationId, eventId),
    budgetEnabled ? listBudgetLines(organizationId, eventId) : Promise.resolve(null),
  ]);

  const quoteDocuments: ModuleDocument[] = [];
  for (const quote of quotes) {
    quoteDocuments.push({
      key: `quote:${quote.id}`,
      label: t("moduleQuote", { number: quote.number }),
      detail: t("moduleQuoteDetail", { version: quote.currentVersion, status: t(`quoteStatus.${quote.status}`) }),
      mime: "application/pdf",
      sizeBytes: null,
      path: `/devis/${quote.id}/pdf?version=${quote.currentVersion}`,
    });
    if (quote.status === "signed") {
      quoteDocuments.push({ key: `signed:${quote.id}`, label: t("moduleSignedQuote", { number: quote.number }), detail: t("moduleOriginal"), mime: "application/pdf", sizeBytes: null, path: `/devis/${quote.id}/signature/signed` });
    }
  }

  const invoiceDocuments: ModuleDocument[] = [];
  for (const invoice of invoices) {
    invoiceDocuments.push({ key: `invoice:${invoice.id}`, label: t("moduleInvoice", { number: invoice.number }), detail: t("moduleOriginal"), mime: "application/pdf", sizeBytes: null, path: `/devis/factures/${invoice.id}/pdf` });
    for (const creditNote of invoice.creditNotes) {
      invoiceDocuments.push({ key: `credit:${creditNote.id}`, label: t("moduleCreditNote", { number: creditNote.number }), detail: t("moduleOriginal"), mime: "application/pdf", sizeBytes: null, path: `/devis/avoirs/${creditNote.id}/pdf` });
    }
  }

  const taskLabels = new Map(tasks.map((task) => [task.id, task.label]));
  const taskDocuments: ModuleDocument[] = attachments.map((attachment) => ({
    key: `task:${attachment.id}`,
    label: attachment.label,
    detail: t("moduleTaskDetail", { task: taskLabels.get(attachment.taskId) ?? "" }),
    mime: attachment.mime,
    sizeBytes: attachment.sizeBytes,
    path: `/events/${eventId}/taches/${attachment.taskId}/pieces/${attachment.id}`,
  }));

  const budgetDocuments: ModuleDocument[] = [];
  for (const line of budget?.lines ?? []) {
    for (const attachment of line.attachments) {
      budgetDocuments.push({
        key: `budget:${attachment.id}`,
        label: line.label,
        detail: tBudget(`documentKind.${attachment.kind}`),
        mime: attachment.mime,
        sizeBytes: attachment.sizeBytes,
        path: `/budget/${eventId}/devis/${attachment.id}`,
      });
    }
  }

  const candidateDocuments: ModuleDocument[] = candidates
    .filter((candidate) => candidate.hasQuoteFile)
    .map((candidate) => ({
      key: `candidate:${candidate.id}`,
      label: t("moduleCandidateQuote", { vendor: candidate.vendorName }),
      detail: null,
      mime: null,
      sizeBytes: candidate.quoteSizeBytes,
      path: `/events/${eventId}/consultes/${candidate.id}/devis`,
    }));

  const folders: ModuleFolder[] = [];
  if (quotesEnabled) {
    folders.push({ key: "quotes", title: t("folderQuotes"), documents: quoteDocuments });
    folders.push({ key: "invoices", title: t("folderInvoices"), documents: invoiceDocuments });
  }
  folders.push({ key: "tasks", title: t("folderTasks"), documents: taskDocuments });
  if (budgetEnabled) folders.push({ key: "budget", title: t("folderBudget"), documents: budgetDocuments });
  folders.push({ key: "candidates", title: t("folderCandidates"), documents: candidateDocuments });
  return folders;
}
