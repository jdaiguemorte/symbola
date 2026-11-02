// Contrat privacy/v1 du module budget (lot 6, ADR 0023). Le module ne porte
// aucun champ texte personnel (le nom du prestataire vit sur le poste, module
// events ; un devis joint n'est connu que par sa clé de stockage) : rien n'y
// est trouvé par un nom ou un e-mail. Le budget d'un événement de la personne
// reste une donnée sur elle : il est rendu par `related`.
import { asc, inArray } from "drizzle-orm";
import { createStorageClient, deletePrivateObject } from "@symbola/files";
import { createAppConnection } from "@symbola/db/client";
import { budgetLineAttachments, budgetLines, eventBudgets } from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";
import { idsOfKind, type ErasureInput, type ErasurePlanItem, type PrivacyContractV1, type PrivacyRecord } from "@symbola/privacy";
import { listEventVendorSlots } from "@/modules/events/service";

const MODULE = "budget";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

// RGPD-03 — budgets et lignes : aucun champ personnel, montants gardés pour
// les totaux (« anonymisés » avec l'événement) ; devis prestataire joint :
// supprimé, fichier compris (pas d'anonymisation partielle d'un PDF).
async function erasurePlan(tx: Tx, input: ErasureInput): Promise<{ plan: ErasurePlanItem[]; attachmentKeys: Map<string, string> }> {
  const plan: ErasurePlanItem[] = [];
  const budgetIds = idsOfKind(input.records, "event_budget");
  const lineIds = idsOfKind(input.records, "budget_line");
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
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, fn);
  } finally {
    await sql.end();
  }
}

export const budgetPrivacy: PrivacyContractV1 = {
  module: MODULE,

  async planErasure(input) {
    return inOrganization(input.organizationId, async (tx) => (await erasurePlan(tx, input)).plan);
  },

  async erase(input) {
    const { plan, attachmentKeys } = await inOrganization(input.organizationId, (tx) => erasurePlan(tx, input));
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

  async find() {
    return [];
  },

  async related({ organizationId, eventIds }) {
    if (eventIds.length === 0) return [];
    const { sql, db } = createAppConnection();
    let rows;
    try {
      rows = await withOrganization(db, organizationId, async (tx) => {
        const budgets = await tx.select().from(eventBudgets).where(inArray(eventBudgets.eventId, eventIds));
        const lines = await tx.select().from(budgetLines).where(inArray(budgetLines.eventId, eventIds)).orderBy(asc(budgetLines.createdAt));
        const attachments =
          lines.length > 0 ? await tx.select().from(budgetLineAttachments).where(inArray(budgetLineAttachments.lineId, lines.map((line) => line.id))) : [];
        return { budgets, lines, attachments };
      });
    } finally {
      await sql.end();
    }

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
        label: slotLabels.get(line.eventVendorSlotId) ?? "",
        fields: {
          plannedAmountCents: String(line.plannedAmountCents),
          ...(line.actualAmountCents !== null ? { actualAmountCents: String(line.actualAmountCents) } : {}),
        },
        eventId: line.eventId,
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
