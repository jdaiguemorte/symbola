// Accès aux données du module budget — jamais importé hors de
// modules/budget/ (ADR 0011).
import { and, asc, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import type { BudgetAmountField, BudgetDocumentKind } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import {
  alertThresholds,
  allocationModelItems,
  allocationModels,
  budgetLineAttachments,
  budgetLineHistory,
  budgetLines,
  eventBudgetItems,
  eventBudgets,
  vendorPayments,
} from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";
import { appendAudit } from "@symbola/db/audit";
import { paidTotalCents } from "./payments";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

export type AllocationModelRow = typeof allocationModels.$inferSelect;
export type AllocationModelItemRow = typeof allocationModelItems.$inferSelect;
export type EventBudgetRow = typeof eventBudgets.$inferSelect;
export type EventBudgetItemRow = typeof eventBudgetItems.$inferSelect;
export type BudgetLineRow = typeof budgetLines.$inferSelect;
export type BudgetLineHistoryRow = typeof budgetLineHistory.$inferSelect;
export type BudgetLineAttachmentRow = typeof budgetLineAttachments.$inferSelect;
export type VendorPaymentRow = typeof vendorPayments.$inferSelect;

export async function findAllocationModels(
  organizationId: string,
): Promise<{ model: AllocationModelRow; items: AllocationModelItemRow[] }[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const models = await tx.select().from(allocationModels).where(eq(allocationModels.organizationId, organizationId));
    const items = await tx
      .select()
      .from(allocationModelItems)
      .where(eq(allocationModelItems.organizationId, organizationId));
    return models.map((model) => ({
      model,
      items: items.filter((item) => item.modelId === model.id),
    }));
  });
}

export async function insertAllocationModel(
  organizationId: string,
  name: string,
  items: { defaultVendorSlotId: string; percentageBasisPoints: number }[],
): Promise<{ model: AllocationModelRow; items: AllocationModelItemRow[] }> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [model] = await tx.insert(allocationModels).values({ organizationId, name }).returning();
    if (!model) throw new Error("création du modèle échouée");

    const insertedItems: AllocationModelItemRow[] = [];
    for (const item of items) {
      const [row] = await tx
        .insert(allocationModelItems)
        .values({
          organizationId,
          modelId: model.id,
          defaultVendorSlotId: item.defaultVendorSlotId,
          percentageBasisPoints: item.percentageBasisPoints,
        })
        .returning();
      if (!row) throw new Error("création d'un poste du modèle échouée");
      insertedItems.push(row);
    }

    return { model, items: insertedItems };
  });
}

export async function deleteAllocationModel(organizationId: string, modelId: string): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, async (tx) => {
    await tx.delete(allocationModelItems).where(eq(allocationModelItems.modelId, modelId));
    await tx.delete(allocationModels).where(eq(allocationModels.id, modelId));
  });
}

export async function findEventBudget(
  organizationId: string,
  eventId: string,
): Promise<{ budget: EventBudgetRow; items: EventBudgetItemRow[] } | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [budget] = await tx.select().from(eventBudgets).where(eq(eventBudgets.eventId, eventId));
    if (!budget) return null;
    const items = await tx
      .select()
      .from(eventBudgetItems)
      .where(eq(eventBudgetItems.eventBudgetId, budget.id));
    return { budget, items };
  });
}

// Remplace entièrement la simulation d'un événement (PRD-BUD-01 : une
// nouvelle simulation écrase la précédente — un seul event_budgets par
// événement, contrainte unique sur event_id).
export async function upsertEventBudget(input: {
  organizationId: string;
  eventId: string;
  totalAmountCents: number;
  guestCount: number;
  allocationModelId: string;
  items: { defaultVendorSlotId: string; amountCents: number }[];
}): Promise<{ budget: EventBudgetRow; items: EventBudgetItemRow[] }> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [existing] = await tx.select().from(eventBudgets).where(eq(eventBudgets.eventId, input.eventId));

    let budget: EventBudgetRow;
    if (existing) {
      await tx.delete(eventBudgetItems).where(eq(eventBudgetItems.eventBudgetId, existing.id));
      const [updated] = await tx
        .update(eventBudgets)
        .set({
          totalAmountCents: input.totalAmountCents,
          guestCount: input.guestCount,
          allocationModelId: input.allocationModelId,
          updatedAt: new Date(),
        })
        .where(eq(eventBudgets.id, existing.id))
        .returning();
      if (!updated) throw new Error("mise à jour de la simulation échouée");
      budget = updated;
    } else {
      const [inserted] = await tx
        .insert(eventBudgets)
        .values({
          organizationId: input.organizationId,
          eventId: input.eventId,
          totalAmountCents: input.totalAmountCents,
          guestCount: input.guestCount,
          allocationModelId: input.allocationModelId,
        })
        .returning();
      if (!inserted) throw new Error("création de la simulation échouée");
      budget = inserted;
    }

    const insertedItems: EventBudgetItemRow[] = [];
    for (const item of input.items) {
      const [row] = await tx
        .insert(eventBudgetItems)
        .values({
          organizationId: input.organizationId,
          eventBudgetId: budget.id,
          defaultVendorSlotId: item.defaultVendorSlotId,
          amountCents: item.amountCents,
        })
        .returning();
      if (!row) throw new Error("création d'un poste de la simulation échouée");
      insertedItems.push(row);
    }

    return { budget, items: insertedItems };
  });
}

// Ajuste à la main le montant d'un poste de la simulation en cours
// (PRD-BUD-01 : « elle peut ajuster un poste à la main »). Met à jour le
// poste s'il existe déjà, le crée sinon (poste ajouté après coup, sans
// repasser par le modèle).
export async function updateEventBudgetItemAmount(input: {
  organizationId: string;
  eventBudgetId: string;
  defaultVendorSlotId: string;
  amountCents: number;
}): Promise<EventBudgetItemRow> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(eventBudgetItems)
      .where(
        and(
          eq(eventBudgetItems.eventBudgetId, input.eventBudgetId),
          eq(eventBudgetItems.defaultVendorSlotId, input.defaultVendorSlotId),
        ),
      );

    if (existing) {
      const [updated] = await tx
        .update(eventBudgetItems)
        .set({ amountCents: input.amountCents, updatedAt: new Date() })
        .where(eq(eventBudgetItems.id, existing.id))
        .returning();
      if (!updated) throw new Error("mise à jour du poste échouée");
      return updated;
    }

    const [inserted] = await tx
      .insert(eventBudgetItems)
      .values({
        organizationId: input.organizationId,
        eventBudgetId: input.eventBudgetId,
        defaultVendorSlotId: input.defaultVendorSlotId,
        amountCents: input.amountCents,
      })
      .returning();
    if (!inserted) throw new Error("création du poste échouée");
    return inserted;
  });
}

export async function findBudgetLines(organizationId: string, eventId: string): Promise<BudgetLineRow[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx.select().from(budgetLines).where(eq(budgetLines.eventId, eventId)).orderBy(asc(budgetLines.position), asc(budgetLines.createdAt)),
  );
}

export async function findBudgetLine(organizationId: string, lineId: string): Promise<BudgetLineRow | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.select().from(budgetLines).where(eq(budgetLines.id, lineId));
    return row ?? null;
  });
}

// Lot 28b (BUD-01, Q33) : la première ligne d'une catégorie (l'ordre, puis la
// date de création) — celle que visent la simulation, l'import sans libellé et
// les écrans qui ne désignent qu'une catégorie.
async function firstLineOfSlot(tx: Tx, eventVendorSlotId: string): Promise<BudgetLineRow | null> {
  const [row] = await tx
    .select()
    .from(budgetLines)
    .where(eq(budgetLines.eventVendorSlotId, eventVendorSlotId))
    .orderBy(asc(budgetLines.position), asc(budgetLines.createdAt))
    .limit(1);
  return row ?? null;
}

export async function findFirstBudgetLineOfSlot(organizationId: string, eventVendorSlotId: string): Promise<BudgetLineRow | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) => firstLineOfSlot(tx, eventVendorSlotId));
}

export async function findBudgetLinesOfSlot(organizationId: string, eventVendorSlotId: string): Promise<BudgetLineRow[]> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx.select().from(budgetLines).where(eq(budgetLines.eventVendorSlotId, eventVendorSlotId)).orderBy(asc(budgetLines.position), asc(budgetLines.createdAt)),
  );
}

async function nextLinePosition(tx: Tx, eventVendorSlotId: string): Promise<number> {
  const [row] = await tx
    .select({ next: sql<number>`coalesce(max(${budgetLines.position}) + 1, 0)::int` })
    .from(budgetLines)
    .where(eq(budgetLines.eventVendorSlotId, eventVendorSlotId));
  return row?.next ?? 0;
}

export async function insertBudgetLine(input: {
  organizationId: string;
  eventId: string;
  eventVendorSlotId: string;
  label: string;
  vendorCandidateId: string | null;
}): Promise<BudgetLineRow> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx
      .insert(budgetLines)
      .values({ ...input, position: await nextLinePosition(tx, input.eventVendorSlotId) })
      .returning();
    if (!row) throw new Error("création de la ligne de budget échouée");
    return row;
  });
}

export async function updateBudgetLineRow(input: { organizationId: string; lineId: string; label?: string; vendorCandidateId?: string | null; vatRateBasisPoints?: number }): Promise<BudgetLineRow | null> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx
      .update(budgetLines)
      .set({
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.vendorCandidateId !== undefined ? { vendorCandidateId: input.vendorCandidateId } : {}),
        ...(input.vatRateBasisPoints !== undefined ? { vatRateBasisPoints: input.vatRateBasisPoints } : {}),
        updatedAt: new Date(),
      })
      .where(eq(budgetLines.id, input.lineId))
      .returning();
    return row ?? null;
  });
}

// Lot 28b : une ligne supprimée emporte son historique, ses échéances et ses
// documents (suppressions journalisées par la base) ; renvoie les clés des
// fichiers à retirer du stockage.
export async function deleteBudgetLine(organizationId: string, lineId: string): Promise<string[] | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [line] = await tx.select({ id: budgetLines.id }).from(budgetLines).where(eq(budgetLines.id, lineId));
    if (!line) return null;
    const attachments = await tx.delete(budgetLineAttachments).where(eq(budgetLineAttachments.lineId, lineId)).returning({ fileKey: budgetLineAttachments.fileKey });
    await tx.delete(vendorPayments).where(eq(vendorPayments.lineId, lineId));
    await tx.delete(budgetLineHistory).where(eq(budgetLineHistory.lineId, lineId));
    await tx.delete(budgetLines).where(eq(budgetLines.id, lineId));
    return attachments.map((attachment) => attachment.fileKey);
  });
}

// Lot 28a (BUD-01) : colonne de chaque montant saisissable.
const AMOUNT_COLUMN = {
  estimated: "estimatedAmountCents",
  quoted: "quotedAmountCents",
  committed: "committedAmountCents",
  paid: "paidAmountCents",
} as const satisfies Record<BudgetAmountField, keyof BudgetLineRow>;

async function writeLineAmount(tx: Tx, organizationId: string, line: BudgetLineRow, field: BudgetAmountField, amountCents: number, changedByUserId: string): Promise<BudgetLineRow> {
  const column = AMOUNT_COLUMN[field];
  const [updated] = await tx
    .update(budgetLines)
    .set({ [column]: amountCents, updatedAt: new Date() })
    .where(eq(budgetLines.id, line.id))
    .returning();
  if (!updated) throw new Error("mise à jour de la ligne de budget échouée");
  // PRD-BUD-02 : « chaque modification est historisée », première valeur comprise.
  await tx.insert(budgetLineHistory).values({ organizationId, lineId: line.id, field, oldValueCents: line[column], newValueCents: amountCents, changedByUserId });
  return updated;
}

// Pose l'un des montants saisissables sur la ligne visée ; sans ligne visée, la
// première de la catégorie, créée au besoin (au libellé de la catégorie) : un
// événement peut recevoir un budget sans être jamais passé par la simulation.
export async function setBudgetLineAmount(input: {
  organizationId: string;
  eventId: string;
  lineId?: string;
  eventVendorSlotId?: string;
  slotLabel?: string;
  field: BudgetAmountField;
  amountCents: number;
  changedByUserId: string;
}): Promise<BudgetLineRow | null> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    let line: BudgetLineRow | null = null;
    if (input.lineId) {
      [line = null] = await tx.select().from(budgetLines).where(and(eq(budgetLines.id, input.lineId), eq(budgetLines.eventId, input.eventId)));
      if (!line) return null;
    } else if (input.eventVendorSlotId) {
      line = await firstLineOfSlot(tx, input.eventVendorSlotId);
      if (!line) {
        const [inserted] = await tx
          .insert(budgetLines)
          .values({ organizationId: input.organizationId, eventId: input.eventId, eventVendorSlotId: input.eventVendorSlotId, label: input.slotLabel ?? "", position: 0 })
          .returning();
        if (!inserted) throw new Error("création de la ligne de budget échouée");
        line = inserted;
      }
    }
    if (!line) return null;
    return writeLineAmount(tx, input.organizationId, line, input.field, input.amountCents, input.changedByUserId);
  });
}

export async function findBudgetLineHistory(organizationId: string, lineIds: string[]): Promise<BudgetLineHistoryRow[]> {
  if (lineIds.length === 0) return [];
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx.select().from(budgetLineHistory).where(inArray(budgetLineHistory.lineId, lineIds)).orderBy(asc(budgetLineHistory.changedAt)),
  );
}

// PRD-BUD-03 — devis prestataires joints aux lignes de budget.
export async function insertBudgetLineAttachment(input: {
  organizationId: string;
  lineId: string;
  kind: BudgetDocumentKind;
  fileKey: string;
  mime: string;
  sizeBytes: number;
  uploadedByUserId: string;
}): Promise<BudgetLineAttachmentRow> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    // Clé étrangère vérifiée sans RLS : on contrôle que la ligne est visible.
    const [line] = await tx.select({ id: budgetLines.id }).from(budgetLines).where(eq(budgetLines.id, input.lineId));
    if (!line) throw new Error("ligne de budget introuvable");
    const [row] = await tx.insert(budgetLineAttachments).values(input).returning();
    if (!row) throw new Error("enregistrement du devis échoué");
    return row;
  });
}

export async function findBudgetLineAttachments(
  organizationId: string,
  lineIds: string[],
): Promise<BudgetLineAttachmentRow[]> {
  if (lineIds.length === 0) return [];
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx
      .select()
      .from(budgetLineAttachments)
      .where(inArray(budgetLineAttachments.lineId, lineIds))
      .orderBy(asc(budgetLineAttachments.createdAt)),
  );
}

export async function findBudgetLineAttachment(
  organizationId: string,
  attachmentId: string,
): Promise<BudgetLineAttachmentRow | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.select().from(budgetLineAttachments).where(eq(budgetLineAttachments.id, attachmentId));
    return row ?? null;
  });
}

// AIDE-02 — suppression de toutes les données budget d'événements
// (essais guidés terminés ou expirés), enfants d'abord. Renvoie les clés
// des devis stockés, à supprimer ensuite du stockage.
export async function deleteEventBudgetRows(organizationId: string, eventIds: string[]): Promise<string[]> {
  if (eventIds.length === 0) return [];
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const lines = await tx.select({ id: budgetLines.id }).from(budgetLines).where(inArray(budgetLines.eventId, eventIds));
    const lineIds = lines.map((line) => line.id);
    let fileKeys: string[] = [];
    if (lineIds.length > 0) {
      const attachments = await tx
        .delete(budgetLineAttachments)
        .where(inArray(budgetLineAttachments.lineId, lineIds))
        .returning({ fileKey: budgetLineAttachments.fileKey });
      fileKeys = attachments.map((attachment) => attachment.fileKey);
      await tx.delete(vendorPayments).where(inArray(vendorPayments.lineId, lineIds));
      await tx.delete(budgetLineHistory).where(inArray(budgetLineHistory.lineId, lineIds));
      await tx.delete(budgetLines).where(inArray(budgetLines.id, lineIds));
    }
    const budgets = await tx
      .select({ id: eventBudgets.id })
      .from(eventBudgets)
      .where(inArray(eventBudgets.eventId, eventIds));
    const budgetIds = budgets.map((budget) => budget.id);
    if (budgetIds.length > 0) {
      await tx.delete(eventBudgetItems).where(inArray(eventBudgetItems.eventBudgetId, budgetIds));
      await tx.delete(eventBudgets).where(inArray(eventBudgets.id, budgetIds));
    }
    return fileKeys;
  });
}

// Lot 28a (BUD-02, décision D4) — seuils d'alerte : celui de l'organisation
// (event_id nul) et celui de l'événement.
export async function findAlertThresholds(organizationId: string, eventId: string | null): Promise<{ organization: number | null; event: number | null }> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const rows = await tx
      .select({ eventId: alertThresholds.eventId, percent: alertThresholds.percent })
      .from(alertThresholds)
      .where(eventId === null ? isNull(alertThresholds.eventId) : or(isNull(alertThresholds.eventId), eq(alertThresholds.eventId, eventId)));
    return {
      organization: rows.find((row) => row.eventId === null)?.percent ?? null,
      event: eventId === null ? null : (rows.find((row) => row.eventId === eventId)?.percent ?? null),
    };
  });
}

export async function upsertAlertThreshold(organizationId: string, eventId: string | null, percent: number): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, async (tx) => {
    await tx
      .insert(alertThresholds)
      .values({ organizationId, eventId, percent })
      .onConflictDoUpdate({ target: [alertThresholds.organizationId, alertThresholds.eventId], set: { percent, updatedAt: new Date() } });
  });
}

export async function deleteEventAlertThreshold(organizationId: string, eventId: string): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, organizationId, async (tx) => {
    await tx.delete(alertThresholds).where(eq(alertThresholds.eventId, eventId));
  });
}

// Lot 28b (BUD-03, D7, D12, D13) — échéances des paiements aux prestataires.
export async function findVendorPayments(organizationId: string, lineIds: string[]): Promise<VendorPaymentRow[]> {
  if (lineIds.length === 0) return [];
  const db = appDatabase();
  return await withOrganization(db, organizationId, (tx) =>
    tx.select().from(vendorPayments).where(inArray(vendorPayments.lineId, lineIds)).orderBy(asc(vendorPayments.dueOn), asc(vendorPayments.position)),
  );
}

export async function findVendorPayment(organizationId: string, paymentId: string): Promise<VendorPaymentRow | null> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const [row] = await tx.select().from(vendorPayments).where(eq(vendorPayments.id, paymentId));
    return row ?? null;
  });
}

// D13 : dès qu'une ligne a des échéances, son payé est la somme de ses échéances
// payées ; le changement est historisé comme une saisie (montant « payé »).
async function refreshLinePaid(tx: Tx, organizationId: string, lineId: string, changedByUserId: string): Promise<void> {
  const [line] = await tx.select().from(budgetLines).where(eq(budgetLines.id, lineId));
  if (!line) return;
  const payments = await tx.select().from(vendorPayments).where(eq(vendorPayments.lineId, lineId));
  if (payments.length === 0) return;
  const paid = paidTotalCents(payments);
  if (paid !== (line.paidAmountCents ?? 0) || line.paidAmountCents === null) await writeLineAmount(tx, organizationId, line, "paid", paid, changedByUserId);
}

export async function insertVendorPayment(input: {
  organizationId: string;
  eventId: string;
  lineId: string;
  label: string;
  fixedAmountCents: number | null;
  percentageBasisPoints: number | null;
  dueOn: string;
  changedByUserId: string;
}): Promise<VendorPaymentRow | null> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [line] = await tx.select({ id: budgetLines.id }).from(budgetLines).where(and(eq(budgetLines.id, input.lineId), eq(budgetLines.eventId, input.eventId)));
    if (!line) return null;
    const [last] = await tx.select({ next: sql<number>`coalesce(max(${vendorPayments.position}) + 1, 0)::int` }).from(vendorPayments).where(eq(vendorPayments.lineId, line.id));
    const { changedByUserId, ...values } = input;
    const [row] = await tx.insert(vendorPayments).values({ ...values, position: last?.next ?? 0 }).returning();
    await refreshLinePaid(tx, input.organizationId, line.id, changedByUserId);
    return row ?? null;
  });
}

export async function updateVendorPaymentRow(input: {
  organizationId: string;
  eventId: string;
  paymentId: string;
  label: string;
  fixedAmountCents: number | null;
  percentageBasisPoints: number | null;
  dueOn: string;
  paidOn?: string | null;
  changedByUserId: string;
}): Promise<VendorPaymentRow | null> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx
      .update(vendorPayments)
      .set({
        label: input.label,
        fixedAmountCents: input.fixedAmountCents,
        percentageBasisPoints: input.percentageBasisPoints,
        dueOn: input.dueOn,
        ...(input.paidOn !== undefined ? { paidOn: input.paidOn } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(vendorPayments.id, input.paymentId), eq(vendorPayments.eventId, input.eventId)))
      .returning();
    if (!row) return null;
    await refreshLinePaid(tx, input.organizationId, row.lineId, input.changedByUserId);
    return row;
  });
}

export async function deleteVendorPaymentRow(input: { organizationId: string; eventId: string; paymentId: string; changedByUserId: string }): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx.delete(vendorPayments).where(and(eq(vendorPayments.id, input.paymentId), eq(vendorPayments.eventId, input.eventId))).returning();
    if (!row) return false;
    await refreshLinePaid(tx, input.organizationId, row.lineId, input.changedByUserId);
    return true;
  });
}

// Bloc « Échéances prestataires » (D7) : échéances non payées jusqu'à la date
// donnée (retards compris), toutes les lignes de leurs événements pour le calcul
// des pourcentages.
export async function findDueVendorPayments(organizationId: string, until: string): Promise<{ payments: VendorPaymentRow[]; lines: BudgetLineRow[] }> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const payments = await tx
      .select()
      .from(vendorPayments)
      .where(and(isNull(vendorPayments.paidOn), lte(vendorPayments.dueOn, until)))
      .orderBy(asc(vendorPayments.dueOn), asc(vendorPayments.position));
    const eventIds = [...new Set(payments.map((payment) => payment.eventId))];
    const lines = eventIds.length > 0 ? await tx.select().from(budgetLines).where(inArray(budgetLines.eventId, eventIds)) : [];
    return { payments, lines };
  });
}

// Lot 27a (SC-06 étape 5, décision D6) — règlement déclaré par un client.

// Déclarer : seulement une échéance ni payée ni déjà déclarée ; un refus
// précédent s'efface. L'appelant fixe l'auteur (le lien) par withActor.
export async function declareVendorPaymentRow(input: {
  organizationId: string;
  eventId: string;
  paymentId: string;
  paidOn: string;
  method: string;
  linkId: string;
  now: Date;
}): Promise<VendorPaymentRow | null> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx
      .update(vendorPayments)
      .set({ declaredPaidOn: input.paidOn, declaredMethod: input.method, declaredByLinkId: input.linkId, declaredAt: input.now, refusalReason: null, refusedAt: null, updatedAt: input.now })
      .where(and(eq(vendorPayments.id, input.paymentId), eq(vendorPayments.eventId, input.eventId), isNull(vendorPayments.paidOn), isNull(vendorPayments.declaredAt)))
      .returning();
    if (!row) return null;
    await appendAudit(tx, { organizationId: input.organizationId, action: "budget.vendor_payment.declared", objectId: input.eventId, details: { paymentId: row.id } });
    return row;
  });
}

// Annuler sa propre déclaration, tant qu'elle n'est pas confirmée.
export async function cancelVendorPaymentDeclarationRow(input: { organizationId: string; eventId: string; paymentId: string; linkId: string; now: Date }): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx
      .update(vendorPayments)
      .set({ declaredPaidOn: null, declaredMethod: null, declaredByLinkId: null, declaredAt: null, updatedAt: input.now })
      .where(and(eq(vendorPayments.id, input.paymentId), eq(vendorPayments.eventId, input.eventId), eq(vendorPayments.declaredByLinkId, input.linkId), isNull(vendorPayments.paidOn)))
      .returning({ id: vendorPayments.id });
    if (!row) return false;
    await appendAudit(tx, { organizationId: input.organizationId, action: "budget.vendor_payment.declaration_cancelled", objectId: input.eventId, details: { paymentId: row.id } });
    return true;
  });
}

// Refus de la planner : la déclaration s'efface, le motif reste pour le client.
export async function refuseVendorPaymentDeclarationRow(input: { organizationId: string; eventId: string; paymentId: string; reason: string; now: Date }): Promise<boolean> {
  const db = appDatabase();
  return await withOrganization(db, input.organizationId, async (tx) => {
    const [row] = await tx
      .update(vendorPayments)
      .set({ declaredPaidOn: null, declaredMethod: null, declaredByLinkId: null, declaredAt: null, refusalReason: input.reason, refusedAt: input.now, updatedAt: input.now })
      .where(and(eq(vendorPayments.id, input.paymentId), eq(vendorPayments.eventId, input.eventId), isNotNull(vendorPayments.declaredAt), isNull(vendorPayments.paidOn)))
      .returning({ id: vendorPayments.id });
    if (!row) return false;
    await appendAudit(tx, { organizationId: input.organizationId, action: "budget.vendor_payment.declaration_refused", objectId: input.eventId, details: { paymentId: row.id } });
    return true;
  });
}

export async function recordDeclarationConfirmedRow(input: { organizationId: string; eventId: string; paymentId: string }): Promise<void> {
  const db = appDatabase();
  await withOrganization(db, input.organizationId, async (tx) => {
    await appendAudit(tx, { organizationId: input.organizationId, action: "budget.vendor_payment.declaration_confirmed", objectId: input.eventId, details: { paymentId: input.paymentId } });
  });
}

// Déclarations en attente de confirmation, et toutes les lignes de leurs
// événements (calcul des pourcentages, libellés).
export async function findPendingDeclarationRows(organizationId: string): Promise<{ payments: VendorPaymentRow[]; lines: BudgetLineRow[] }> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, async (tx) => {
    const payments = await tx
      .select()
      .from(vendorPayments)
      .where(and(isNotNull(vendorPayments.declaredAt), isNull(vendorPayments.paidOn)))
      .orderBy(asc(vendorPayments.declaredAt));
    const eventIds = [...new Set(payments.map((payment) => payment.eventId))];
    const lines = eventIds.length > 0 ? await tx.select().from(budgetLines).where(inArray(budgetLines.eventId, eventIds)) : [];
    return { payments, lines };
  });
}
