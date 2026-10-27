// Accès aux données du module budget — jamais importé hors de
// modules/budget/ (ADR 0011).
import { and, eq } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import {
  allocationModelItems,
  allocationModels,
  budgetLineHistory,
  budgetLines,
  eventBudgetItems,
  eventBudgets,
} from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";

export type AllocationModelRow = typeof allocationModels.$inferSelect;
export type AllocationModelItemRow = typeof allocationModelItems.$inferSelect;
export type EventBudgetRow = typeof eventBudgets.$inferSelect;
export type EventBudgetItemRow = typeof eventBudgetItems.$inferSelect;
export type BudgetLineRow = typeof budgetLines.$inferSelect;
export type BudgetLineHistoryRow = typeof budgetLineHistory.$inferSelect;

export async function findAllocationModels(
  organizationId: string,
): Promise<{ model: AllocationModelRow; items: AllocationModelItemRow[] }[]> {
  const { sql, db } = createAppConnection();
  try {
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
  } finally {
    await sql.end();
  }
}

export async function insertAllocationModel(
  organizationId: string,
  name: string,
  items: { defaultVendorSlotId: string; percentageBasisPoints: number }[],
): Promise<{ model: AllocationModelRow; items: AllocationModelItemRow[] }> {
  const { sql, db } = createAppConnection();
  try {
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
  } finally {
    await sql.end();
  }
}

export async function deleteAllocationModel(organizationId: string, modelId: string): Promise<void> {
  const { sql, db } = createAppConnection();
  try {
    await withOrganization(db, organizationId, async (tx) => {
      await tx.delete(allocationModelItems).where(eq(allocationModelItems.modelId, modelId));
      await tx.delete(allocationModels).where(eq(allocationModels.id, modelId));
    });
  } finally {
    await sql.end();
  }
}

export async function findEventBudget(
  organizationId: string,
  eventId: string,
): Promise<{ budget: EventBudgetRow; items: EventBudgetItemRow[] } | null> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [budget] = await tx.select().from(eventBudgets).where(eq(eventBudgets.eventId, eventId));
      if (!budget) return null;
      const items = await tx
        .select()
        .from(eventBudgetItems)
        .where(eq(eventBudgetItems.eventBudgetId, budget.id));
      return { budget, items };
    });
  } finally {
    await sql.end();
  }
}

// Remplace entièrement la simulation d'un événement (BUD-01 : une
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
  const { sql, db } = createAppConnection();
  try {
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
  } finally {
    await sql.end();
  }
}

// Ajuste à la main le montant d'un poste de la simulation en cours
// (BUD-01 : « elle peut ajuster un poste à la main »). Met à jour le
// poste s'il existe déjà, le crée sinon (poste ajouté après coup, sans
// repasser par le modèle).
export async function updateEventBudgetItemAmount(input: {
  organizationId: string;
  eventBudgetId: string;
  defaultVendorSlotId: string;
  amountCents: number;
}): Promise<EventBudgetItemRow> {
  const { sql, db } = createAppConnection();
  try {
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
  } finally {
    await sql.end();
  }
}

export async function findBudgetLines(organizationId: string, eventId: string): Promise<BudgetLineRow[]> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, (tx) =>
      tx.select().from(budgetLines).where(eq(budgetLines.eventId, eventId)),
    );
  } finally {
    await sql.end();
  }
}

export async function findBudgetLineByEventVendorSlotId(
  organizationId: string,
  eventVendorSlotId: string,
): Promise<BudgetLineRow | null> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, async (tx) => {
      const [row] = await tx.select().from(budgetLines).where(eq(budgetLines.eventVendorSlotId, eventVendorSlotId));
      return row ?? null;
    });
  } finally {
    await sql.end();
  }
}

// Pose planned_amount_cents ou actual_amount_cents selon `field`, crée la
// ligne si elle n'existe pas encore (un événement peut recevoir un budget
// réel sans être jamais passé par la simulation), et historise toujours
// la modification — y compris la toute première valeur posée (BUD-02 :
// « chaque modification est historisée »).
export async function setBudgetLineAmount(input: {
  organizationId: string;
  eventId: string;
  eventVendorSlotId: string;
  field: "planned" | "actual";
  amountCents: number;
  changedByUserId: string;
}): Promise<BudgetLineRow> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, input.organizationId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(budgetLines)
        .where(eq(budgetLines.eventVendorSlotId, input.eventVendorSlotId));

      const oldValueCents =
        existing === undefined
          ? null
          : input.field === "planned"
            ? existing.plannedAmountCents
            : existing.actualAmountCents;

      let line: BudgetLineRow;
      if (existing) {
        const [updated] = await tx
          .update(budgetLines)
          .set({
            ...(input.field === "planned"
              ? { plannedAmountCents: input.amountCents }
              : { actualAmountCents: input.amountCents }),
            updatedAt: new Date(),
          })
          .where(eq(budgetLines.id, existing.id))
          .returning();
        if (!updated) throw new Error("mise à jour de la ligne de budget échouée");
        line = updated;
      } else {
        const [inserted] = await tx
          .insert(budgetLines)
          .values({
            organizationId: input.organizationId,
            eventId: input.eventId,
            eventVendorSlotId: input.eventVendorSlotId,
            plannedAmountCents: input.field === "planned" ? input.amountCents : 0,
            actualAmountCents: input.field === "actual" ? input.amountCents : null,
          })
          .returning();
        if (!inserted) throw new Error("création de la ligne de budget échouée");
        line = inserted;
      }

      await tx.insert(budgetLineHistory).values({
        organizationId: input.organizationId,
        lineId: line.id,
        field: input.field,
        oldValueCents,
        newValueCents: input.amountCents,
        changedByUserId: input.changedByUserId,
      });

      return line;
    });
  } finally {
    await sql.end();
  }
}

export async function findBudgetLineHistory(organizationId: string, lineId: string): Promise<BudgetLineHistoryRow[]> {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, (tx) =>
      tx.select().from(budgetLineHistory).where(eq(budgetLineHistory.lineId, lineId)),
    );
  } finally {
    await sql.end();
  }
}
