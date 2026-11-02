// Contrat privacy/v1 du module budget (lot 6, ADR 0023). Le module ne porte
// aucun champ texte personnel (le nom du prestataire vit sur le poste, module
// events ; un devis joint n'est connu que par sa clé de stockage) : rien n'y
// est trouvé par un nom ou un e-mail. Le budget d'un événement de la personne
// reste une donnée sur elle : il est rendu par `related`.
import { asc, inArray } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { budgetLineAttachments, budgetLines, eventBudgets } from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";
import type { PrivacyContractV1, PrivacyRecord } from "@symbola/privacy";
import { listEventVendorSlots } from "@/modules/events/service";

const MODULE = "budget";

export const budgetPrivacy: PrivacyContractV1 = {
  module: MODULE,

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
