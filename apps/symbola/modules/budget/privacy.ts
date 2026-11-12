// Contrat privacy/v1 du module budget (lot 6, ADR 0023). Le nom des
// prestataires vit au module events ; un document joint n'est connu que par sa
// clé de stockage. Lot 28b (Q33, BUD-03) : le libellé d'une ligne et celui d'une
// échéance sont des textes libres (« Robe de Léa ») : trouvés par un nom,
// exportés, anonymisés. Le budget d'un événement de la personne reste une
// donnée sur elle : il est rendu par `related`.
import { asc, inArray } from "drizzle-orm";
import { createStorageClient, deletePrivateObject } from "@symbola/files";
import { appDatabase } from "@symbola/db/client";
import { budgetLineAttachments, budgetLines, eventBudgets, vendorPayments } from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";
import { ANONYMIZED, hasTerms, idsOfKind, prepareTerms, recordMatches, type ErasureInput, type ErasurePlanItem, type PrivacyContractV1, type PrivacyRecord } from "@symbola/privacy";
import { getEvent, listEventVendorSlots } from "@/modules/events/service";

const MODULE = "budget";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

// RGPD-03 — budgets et lignes : aucun champ personnel, montants gardés pour
// les totaux (« anonymisés » avec l'événement) ; devis prestataire joint :
// supprimé, fichier compris (pas d'anonymisation partielle d'un PDF).
async function erasurePlan(tx: Tx, input: ErasureInput): Promise<{ plan: ErasurePlanItem[]; attachmentKeys: Map<string, string> }> {
  const plan: ErasurePlanItem[] = [];
  const budgetIds = idsOfKind(input.records, "event_budget");
  const lineIds = idsOfKind(input.records, "budget_line");
  const paymentIds = idsOfKind(input.records, "vendor_payment");
  const attachmentIds = idsOfKind(input.records, "budget_attachment");
  if (budgetIds.length > 0) {
    for (const row of await tx.select({ id: eventBudgets.id }).from(eventBudgets).where(inArray(eventBudgets.id, budgetIds))) {
      plan.push({ kind: "event_budget", recordId: row.id, fate: "anonymized", legalBasis: null, keptUntil: null });
    }
  }
  if (lineIds.length > 0) {
    for (const row of await tx.select({ id: budgetLines.id }).from(budgetLines).where(inArray(budgetLines.id, lineIds))) {
      plan.push({ kind: "budget_line", recordId: row.id, fate: "anonymized", legalBasis: null, keptUntil: null });
    }
  }
  if (paymentIds.length > 0) {
    for (const row of await tx.select({ id: vendorPayments.id }).from(vendorPayments).where(inArray(vendorPayments.id, paymentIds))) {
      plan.push({ kind: "vendor_payment", recordId: row.id, fate: "anonymized", legalBasis: null, keptUntil: null });
    }
  }
  const attachmentKeys = new Map<string, string>();
  if (attachmentIds.length > 0) {
    for (const row of await tx.select({ id: budgetLineAttachments.id, fileKey: budgetLineAttachments.fileKey }).from(budgetLineAttachments).where(inArray(budgetLineAttachments.id, attachmentIds))) {
      attachmentKeys.set(row.id, row.fileKey);
      plan.push({ kind: "budget_attachment", recordId: row.id, fate: "deleted", legalBasis: null, keptUntil: null });
    }
  }
  return { plan, attachmentKeys };
}

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

export const budgetPrivacy: PrivacyContractV1 = {
  module: MODULE,

  async planErasure(input) {
    return inOrganization(input.organizationId, async (tx) => (await erasurePlan(tx, input)).plan);
  },

  async erase(input) {
    const { plan, attachmentKeys } = await inOrganization(input.organizationId, (tx) => erasurePlan(tx, input));
    // Lot 28b : les montants restent (totaux) ; les libellés libres sont anonymisés.
    const lineIds = plan.filter((item) => item.kind === "budget_line").map((item) => item.recordId);
    const paymentIds = plan.filter((item) => item.kind === "vendor_payment").map((item) => item.recordId);
    if (lineIds.length > 0 || paymentIds.length > 0) {
      await inOrganization(input.organizationId, async (tx) => {
        if (lineIds.length > 0) await tx.update(budgetLines).set({ label: ANONYMIZED, updatedAt: new Date() }).where(inArray(budgetLines.id, lineIds));
        if (paymentIds.length > 0) await tx.update(vendorPayments).set({ label: ANONYMIZED, refusalReason: null, updatedAt: new Date() }).where(inArray(vendorPayments.id, paymentIds));
      });
    }
    if (attachmentKeys.size > 0) {
      // Fichiers d'abord : en cas d'échec, la ligne reste et une nouvelle
      // exécution recommence (supprimer un fichier déjà absent ne fait rien) ;
      // jamais de fichier orphelin introuvable.
      const storage = createStorageClient();
      for (const key of attachmentKeys.values()) await deletePrivateObject(storage, key);
      await inOrganization(input.organizationId, (tx) => tx.delete(budgetLineAttachments).where(inArray(budgetLineAttachments.id, [...attachmentKeys.keys()])));
    }
    return plan;
  },

  // Lot 28b : libellés des lignes et des échéances, hors événements d'essai.
  async find({ organizationId, terms: rawTerms }) {
    const terms = prepareTerms(rawTerms);
    if (!hasTerms(terms)) return [];
    const { lines, payments } = await inOrganization(organizationId, async (tx) => {
      const lines = await tx.select().from(budgetLines);
      const payments = await tx.select().from(vendorPayments);
      return { lines: lines.filter((line) => recordMatches([line.label], terms)), payments: payments.filter((payment) => recordMatches([payment.label], terms)) };
    });
    const realEvent = new Map<string, boolean>();
    for (const eventId of new Set([...lines.map((line) => line.eventId), ...payments.map((payment) => payment.eventId)])) {
      realEvent.set(eventId, (await getEvent(organizationId, eventId))?.isDemo === false);
    }
    return [
      ...lines.filter((line) => realEvent.get(line.eventId)).map((line): PrivacyRecord => ({
        module: MODULE,
        kind: "budget_line",
        recordId: line.id,
        label: line.label,
        fields: { label: line.label },
        eventId: line.eventId,
      })),
      ...payments.filter((payment) => realEvent.get(payment.eventId)).map((payment): PrivacyRecord => ({
        module: MODULE,
        kind: "vendor_payment",
        recordId: payment.id,
        label: payment.label,
        fields: { paymentLabel: payment.label },
        eventId: payment.eventId,
      })),
    ];
  },

  async related({ organizationId, eventIds }) {
    if (eventIds.length === 0) return [];
    const db = appDatabase();
    const rows = await withOrganization(db, organizationId, async (tx) => {
      const budgets = await tx.select().from(eventBudgets).where(inArray(eventBudgets.eventId, eventIds));
      const lines = await tx.select().from(budgetLines).where(inArray(budgetLines.eventId, eventIds)).orderBy(asc(budgetLines.createdAt));
      const lineIds = lines.map((line) => line.id);
      const attachments = lineIds.length > 0 ? await tx.select().from(budgetLineAttachments).where(inArray(budgetLineAttachments.lineId, lineIds)) : [];
      const payments = lineIds.length > 0 ? await tx.select().from(vendorPayments).where(inArray(vendorPayments.lineId, lineIds)).orderBy(asc(vendorPayments.dueOn)) : [];
      return { budgets, lines, attachments, payments };
    });

    // Intitulés des postes, lus par le service du module events (ADR 0011).
    const slotLabels = new Map<string, string>();
    for (const eventId of new Set(rows.lines.map((line) => line.eventId))) {
      for (const slot of await listEventVendorSlots(organizationId, eventId)) slotLabels.set(slot.id, slot.label);
    }
    const records: PrivacyRecord[] = [];
    for (const budget of rows.budgets) {
      records.push({
        module: MODULE,
        kind: "event_budget",
        recordId: budget.id,
        label: String(budget.totalAmountCents),
        fields: { totalAmountCents: String(budget.totalAmountCents) },
        eventId: budget.eventId,
      });
    }
    const lineEvent = new Map(rows.lines.map((line) => [line.id, line.eventId]));
    for (const line of rows.lines) {
      records.push({
        module: MODULE,
        kind: "budget_line",
        recordId: line.id,
        label: line.label || (slotLabels.get(line.eventVendorSlotId) ?? ""),
        fields: {
          ...(line.label ? { label: line.label } : {}),
          // Lot 28a (BUD-01) : les quatre montants saisis de la ligne.
          estimatedAmountCents: line.estimatedAmountCents === null ? "" : String(line.estimatedAmountCents),
          ...(line.quotedAmountCents !== null ? { quotedAmountCents: String(line.quotedAmountCents) } : {}),
          ...(line.committedAmountCents !== null ? { committedAmountCents: String(line.committedAmountCents) } : {}),
          ...(line.paidAmountCents !== null ? { paidAmountCents: String(line.paidAmountCents) } : {}),
        },
        eventId: line.eventId,
      });
    }
    for (const payment of rows.payments) {
      records.push({
        module: MODULE,
        kind: "vendor_payment",
        recordId: payment.id,
        label: payment.label,
        fields: {
          paymentLabel: payment.label,
          ...(payment.fixedAmountCents !== null ? { amountCents: String(payment.fixedAmountCents) } : {}),
          dueOn: payment.dueOn,
          ...(payment.paidOn ? { paidOn: payment.paidOn } : {}),
        },
        eventId: payment.eventId,
      });
    }
    for (const attachment of rows.attachments) {
      records.push({
        module: MODULE,
        kind: "budget_attachment",
        recordId: attachment.id,
        label: attachment.mime,
        fields: { mime: attachment.mime, sizeBytes: String(attachment.sizeBytes) },
        eventId: lineEvent.get(attachment.lineId) ?? null,
      });
    }
    return records;
  },
};
