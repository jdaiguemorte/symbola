// Lot 29b (JRJ-04, décision D8 ; ADR 0064) — documents qu'on peut embarquer pour le
// jour J d'un événement, rassemblés auprès de chaque module par son service.ts
// (ADR 0011) : documents de l'événement (events), devis signés (quotes), pièces des
// lignes du budget (budget), devis joints aux prestataires retenus (events). Un
// module non souscrit n'en propose aucun (dégradation propre). Les fichiers du
// carnet (plaquettes, RIB) n'en sont jamais. C'est aussi la preuve qu'une pièce
// appartient à l'événement : on n'embarque et ne sert que ce qui est listé ici.
import { getTranslations } from "next-intl/server";
import type { DayDocumentSource, FileDownload } from "@symbola/contracts";
import { getEventDocumentFile, getVendorCandidateQuoteFile, listDayDocumentChoices, listEventDocuments, listVendorCandidates } from "@/modules/events/service";
import { getSignatureDocument, listEventQuotes } from "@/modules/quotes/service";
import { getBudgetLineAttachmentFile, listBudgetLines } from "@/modules/budget/service";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";

export type DayDocumentCandidate = {
  source: DayDocumentSource;
  sourceId: string;
  label: string;
  // Nature affichée (« Document de l'événement », « Devis signé »…).
  origin: string;
  mime: string | null;
  sizeBytes: number | null;
  embedded: boolean;
  path: string;
};

export function dayDocumentPath(eventId: string, source: DayDocumentSource, sourceId: string): string {
  return `/jour-j/${eventId}/documents/${source}/${sourceId}`;
}

export function dayDocumentKey(source: DayDocumentSource, sourceId: string): string {
  return `${source}:${sourceId}`;
}

export async function listDayDocumentCandidates(organizationId: string, eventId: string): Promise<DayDocumentCandidate[]> {
  const t = await getTranslations("DayOf");
  const tBudget = await getTranslations("Budget");
  const [documents, choices, candidates, quotesEnabled, budgetEnabled] = await Promise.all([
    listEventDocuments(organizationId, eventId),
    listDayDocumentChoices(organizationId, eventId),
    listVendorCandidates(organizationId, eventId),
    isQuotesModuleEnabled(organizationId),
    isBudgetModuleEnabled(organizationId),
  ]);
  const chosen = new Set(choices.map((choice) => dayDocumentKey(choice.source, choice.sourceId)));
  const candidate = (source: DayDocumentSource, sourceId: string, label: string, mime: string | null, sizeBytes: number | null): DayDocumentCandidate => ({
    source,
    sourceId,
    label,
    origin: t(`documentOrigin.${source}`),
    mime,
    sizeBytes,
    embedded: chosen.has(dayDocumentKey(source, sourceId)),
    path: dayDocumentPath(eventId, source, sourceId),
  });

  const list: DayDocumentCandidate[] = documents.map((document) => candidate("event_document", document.id, document.label, document.mime, document.sizeBytes));
  if (quotesEnabled) {
    for (const quote of await listEventQuotes(organizationId, eventId)) {
      if (quote.status === "signed") list.push(candidate("signed_quote", quote.id, t("signedQuoteLabel", { number: quote.number }), "application/pdf", null));
    }
  }
  if (budgetEnabled) {
    for (const line of (await listBudgetLines(organizationId, eventId)).lines) {
      for (const attachment of line.attachments) {
        list.push(candidate("budget_attachment", attachment.id, t("budgetAttachmentLabel", { line: line.label, kind: tBudget(`documentKind.${attachment.kind}`) }), attachment.mime, attachment.sizeBytes));
      }
    }
  }
  for (const vendor of candidates.filter((entry) => entry.outcome === "selected" && entry.hasQuoteFile)) {
    list.push(candidate("candidate_quote", vendor.id, t("candidateQuoteLabel", { vendor: vendor.vendorName }), null, vendor.quoteSizeBytes));
  }
  return list;
}

// Fichier d'une pièce, lu par le module qui la détient ; l'appelant a vérifié qu'elle
// figure parmi les candidats de l'événement.
export async function readDayDocument(organizationId: string, source: DayDocumentSource, sourceId: string): Promise<FileDownload> {
  switch (source) {
    case "event_document":
      return getEventDocumentFile(organizationId, sourceId);
    case "signed_quote":
      return getSignatureDocument(organizationId, sourceId, "signed");
    case "budget_attachment":
      return getBudgetLineAttachmentFile(organizationId, sourceId);
    case "candidate_quote":
      return getVendorCandidateQuoteFile(organizationId, sourceId);
  }
}
