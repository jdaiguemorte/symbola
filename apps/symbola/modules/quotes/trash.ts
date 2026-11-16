// Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) — corbeille du module quotes : les devis d'un évènement
// supprimé le suivent (marqués à sa date), les modèles de devis et de contrat vont à la corbeille,
// les lignes de devis s'annulent ; ce qui empêche de supprimer un évènement (pièces à conserver,
// décision D4). Exposé seulement par service.ts (ADR 0011). Les lectures ici voient la corbeille.
import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { includingDeleted } from "@symbola/db/actor";
import {
  contractTemplates,
  earnestReceipts,
  invoices,
  paymentEntries,
  paymentScheduleItems,
  quoteLines,
  quotes,
  quoteTemplates,
  quoteVersions,
  signatureRequests,
} from "@symbola/db/schema/quotes";
import { inTrash, markDeleted, UNMARKED } from "@symbola/db/soft-delete";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QuotesTrashKind = "quoteTemplate" | "contractTemplate";

export type TrashedQuotesRow = { kind: QuotesTrashKind; id: string; label: string; eventId: null; deletedAt: Date; deletedBy: string | null };

// Ce qu'un évènement porte et qui doit être conservé (ADR 0024, 0061) : il ne se supprime pas,
// il s'annule.
export type RetainedDocuments = { signedQuotes: number; signatures: number; invoices: number; earnestReceipts: number; payments: number };

export async function findRetainedDocuments(organizationId: string, eventId: string): Promise<RetainedDocuments> {
  const none = { signedQuotes: 0, signatures: 0, invoices: 0, earnestReceipts: 0, payments: 0 };
  if (!UUID.test(eventId)) return none;
  return inTrash(organizationId, async (tx) => {
    const eventQuotes = await tx.select({ id: quotes.id, status: quotes.status }).from(quotes).where(eq(quotes.eventId, eventId));
    if (eventQuotes.length === 0) return none;
    const quoteIds = eventQuotes.map((quote) => quote.id);
    const versionIds = (await tx.select({ id: quoteVersions.id }).from(quoteVersions).where(inArray(quoteVersions.quoteId, quoteIds))).map((row) => row.id);
    const signatures =
      versionIds.length > 0
        ? await tx
            .select({ id: signatureRequests.id })
            .from(signatureRequests)
            .where(and(inArray(signatureRequests.versionId, versionIds), inArray(signatureRequests.status, ["pending", "completed"])))
        : [];
    const scheduleIds =
      versionIds.length > 0 ? (await tx.select({ id: paymentScheduleItems.id }).from(paymentScheduleItems).where(inArray(paymentScheduleItems.versionId, versionIds))).map((row) => row.id) : [];
    const payments = scheduleIds.length > 0 ? await tx.select({ id: paymentEntries.id }).from(paymentEntries).where(inArray(paymentEntries.scheduleItemId, scheduleIds)) : [];
    return {
      signedQuotes: eventQuotes.filter((quote) => quote.status === "signed").length,
      signatures: signatures.length,
      invoices: (await tx.select({ id: invoices.id }).from(invoices).where(inArray(invoices.quoteId, quoteIds))).length,
      earnestReceipts: (await tx.select({ id: earnestReceipts.id }).from(earnestReceipts).where(inArray(earnestReceipts.quoteId, quoteIds))).length,
      payments: payments.length,
    };
  });
}

// Les devis de l'évènement suivent sa suppression, à la même date (restauration : seulement ceux de
// cette date).
export async function trashEventQuoteRows(organizationId: string, eventId: string, at: Date): Promise<number> {
  if (!UUID.test(eventId)) return 0;
  const rows = await inTrash(organizationId, (tx) => tx.update(quotes).set(markDeleted(at)).where(and(eq(quotes.eventId, eventId), isNull(quotes.deletedAt))).returning({ id: quotes.id }));
  return rows.length;
}

export async function restoreEventQuoteRows(organizationId: string, eventId: string, at: Date): Promise<number> {
  if (!UUID.test(eventId)) return 0;
  const rows = await inTrash(organizationId, (tx) => tx.update(quotes).set(UNMARKED).where(and(eq(quotes.eventId, eventId), eq(quotes.deletedAt, at))).returning({ id: quotes.id }));
  return rows.length;
}

async function unmark(organizationId: string, table: typeof quoteTemplates | typeof contractTemplates, id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const rows = await inTrash(organizationId, (tx) => tx.update(table).set(UNMARKED).where(and(eq(table.id, id), isNotNull(table.deletedAt))).returning({ id: table.id }));
  return rows.length > 0;
}

export function restoreQuoteTemplateRow(organizationId: string, templateId: string): Promise<boolean> {
  return unmark(organizationId, quoteTemplates, templateId);
}

export function restoreContractTemplateRow(organizationId: string, templateId: string): Promise<boolean> {
  return unmark(organizationId, contractTemplates, templateId);
}

export async function listTrashedQuotesRows(organizationId: string): Promise<TrashedQuotesRow[]> {
  return inTrash(organizationId, async (tx) => {
    const quoteRows = await tx
      .select({ id: quoteTemplates.id, label: quoteTemplates.name, deletedAt: quoteTemplates.deletedAt, deletedBy: quoteTemplates.deletedBy })
      .from(quoteTemplates)
      .where(isNotNull(quoteTemplates.deletedAt));
    const contractRows = await tx
      .select({ id: contractTemplates.id, label: contractTemplates.name, deletedAt: contractTemplates.deletedAt, deletedBy: contractTemplates.deletedBy })
      .from(contractTemplates)
      .where(isNotNull(contractTemplates.deletedAt));
    return [
      ...quoteRows.map((row) => ({ kind: "quoteTemplate" as const, id: row.id, label: row.label, eventId: null, deletedAt: row.deletedAt!, deletedBy: row.deletedBy })),
      ...contractRows.map((row) => ({ kind: "contractTemplate" as const, id: row.id, label: row.label, eventId: null, deletedAt: row.deletedAt!, deletedBy: row.deletedBy })),
    ];
  });
}

export async function isQuotesObjectTrashed(organizationId: string, kind: QuotesTrashKind, id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const table = kind === "quoteTemplate" ? quoteTemplates : contractTemplates;
  return inTrash(organizationId, async (tx) => (await tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), isNotNull(table.deletedAt)))).length > 0);
}

// Lignes de devis retirées avant la date donnée (« Annuler » passé).
export async function purgeQuotesElements(organizationId: string, before: Date): Promise<number> {
  const rows = await inTrash(organizationId, (tx) => tx.delete(quoteLines).where(and(isNotNull(quoteLines.deletedAt), lt(quoteLines.deletedAt, before))).returning({ id: quoteLines.id }));
  return rows.length;
}

type ObjectFilter = { before: Date } | { kind: QuotesTrashKind; id: string };

// Modèles de devis et de contrat de la corbeille (leurs lignes, sections, échéances et clauses
// partent avec eux) : ceux marqués avant la date donnée, ou un seul.
export async function purgeTrashedQuotesObjects(organizationId: string, filter: ObjectFilter): Promise<number> {
  const condition = (table: typeof quoteTemplates | typeof contractTemplates, kind: QuotesTrashKind) => {
    if ("before" in filter) return and(isNotNull(table.deletedAt), lt(table.deletedAt, filter.before));
    if (filter.kind !== kind || !UUID.test(filter.id)) return undefined;
    return and(isNotNull(table.deletedAt), eq(table.id, filter.id));
  };
  return includingDeleted(() =>
    inTrash(organizationId, async (tx) => {
      let removed = 0;
      const quoteCondition = condition(quoteTemplates, "quoteTemplate");
      if (quoteCondition) removed += (await tx.delete(quoteTemplates).where(quoteCondition).returning({ id: quoteTemplates.id })).length;
      const contractCondition = condition(contractTemplates, "contractTemplate");
      if (contractCondition) removed += (await tx.delete(contractTemplates).where(contractCondition).returning({ id: contractTemplates.id })).length;
      return removed;
    }),
  );
}
