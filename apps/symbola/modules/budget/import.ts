// IMP-05 — import de lignes de budget (lot 5, ADR 0022), exposé par
// service.ts. Une ligne de budget est portée par un poste de l'événement
// (module events, BUD-02) : le poste est d'abord créé ou mis à jour par le
// service du module events, puis les montants sont écrits ici en une
// transaction, historisés comme une saisie à la main. Si cette seconde
// écriture échoue, les postes écrits sont annulés (compensation : deux
// modules, deux transactions).
import { eq, inArray, sql } from "drizzle-orm";
import { sameImportValue, type ImportApplyResult, type ImportApplyRow, type ImportedItem, type ImportUndoItem, type ImportUndoOutcome } from "@symbola/contracts";
import { createAppConnection } from "@symbola/db/client";
import { budgetLineAttachments, budgetLineHistory, budgetLines } from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";
import { importVendorSlotsForBudget, undoImportedEventsElements } from "@/modules/events/service";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type Values = Record<string, unknown>;

async function inTransaction<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, fn);
  } finally {
    await pg.end();
  }
}

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

async function lineState(tx: Tx, lineId: string): Promise<Values | null> {
  const [line] = await tx.select().from(budgetLines).where(eq(budgetLines.id, lineId));
  if (!line) return null;
  return { plannedAmountCents: line.plannedAmountCents, actualAmountCents: line.actualAmountCents };
}

async function history(tx: Tx, organizationId: string, lineId: string, userId: string, before: Values, after: Values): Promise<void> {
  for (const [field, key] of [
    ["planned", "plannedAmountCents"],
    ["actual", "actualAmountCents"],
  ] as const) {
    if (!(key in after) || after[key] === null || after[key] === before[key]) continue;
    await tx.insert(budgetLineHistory).values({
      organizationId,
      lineId,
      field,
      oldValueCents: (before[key] as number | null) ?? null,
      newValueCents: after[key] as number,
      changedByUserId: userId,
    });
  }
}

export async function importBudgetLineRows(input: { organizationId: string; userId: string; rows: ImportApplyRow[] }): Promise<ImportApplyResult> {
  const slots = await importVendorSlotsForBudget({ organizationId: input.organizationId, rows: input.rows });
  try {
    const result = await inTransaction(input.organizationId, async (tx) => {
      const items: ImportedItem[] = [];
      let unchanged = 0;
      for (const row of input.rows) {
        const slotId = slots.slotIdByRow.get(row.rowIndex);
        if (!slotId || !row.eventId) throw new Error("poste de la ligne introuvable");
        const planned = amount(row.values.plannedAmount);
        const actual = amount(row.values.actualAmount);
        const [existing] = await tx.select().from(budgetLines).where(eq(budgetLines.eventVendorSlotId, slotId));
        if (existing) {
          const current = { plannedAmountCents: existing.plannedAmountCents, actualAmountCents: existing.actualAmountCents };
          const written: Values = {};
          if (planned !== null && planned !== current.plannedAmountCents) written.plannedAmountCents = planned;
          if (actual !== null && actual !== current.actualAmountCents) written.actualAmountCents = actual;
          if (Object.keys(written).length === 0) {
            if (!slots.items.some((item) => item.rowIndex === row.rowIndex)) unchanged += 1;
            continue;
          }
          await tx
            .update(budgetLines)
            .set({ ...(written as Partial<typeof budgetLines.$inferInsert>), updatedAt: new Date() })
            .where(eq(budgetLines.id, existing.id));
          await history(tx, input.organizationId, existing.id, input.userId, current, written);
          const previous = Object.fromEntries(Object.keys(written).map((key) => [key, current[key as keyof typeof current]]));
          items.push({ rowIndex: row.rowIndex, module: "budget", kind: "budget_line", elementId: existing.id, action: "updated", previous, written });
          continue;
        }
        const [line] = await tx
          .insert(budgetLines)
          .values({
            organizationId: input.organizationId,
            eventId: row.eventId,
            eventVendorSlotId: slotId,
            plannedAmountCents: planned,
            actualAmountCents: actual,
          })
          .returning();
        if (!line) throw new Error("création de la ligne de budget échouée");
        const written = { plannedAmountCents: line.plannedAmountCents, actualAmountCents: line.actualAmountCents };
        await history(tx, input.organizationId, line.id, input.userId, { plannedAmountCents: null, actualAmountCents: null }, written);
        items.push({ rowIndex: row.rowIndex, module: "budget", kind: "budget_line", elementId: line.id, action: "created", previous: null, written });
      }
      return { items, unchanged };
    });
    return { items: [...slots.items, ...result.items], unchanged: result.unchanged };
  } catch (error) {
    // Compensation : les postes écrits juste avant sont annulés.
    await undoImportedEventsElements(
      input.organizationId,
      input.userId,
      [...slots.items].reverse().map((item) => ({ ...item, force: true })),
    );
    throw error;
  }
}

function modifiedSince(current: Values, written: Values | null): boolean {
  return Object.keys(written ?? {}).some((key) => !sameImportValue(current[key], (written ?? {})[key]));
}

async function hasAttachments(tx: Tx, lineId: string): Promise<boolean> {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(budgetLineAttachments).where(eq(budgetLineAttachments.lineId, lineId));
  return (row?.n ?? 0) > 0;
}

export async function findModifiedImportedBudgetElements(
  organizationId: string,
  items: Pick<ImportUndoItem, "kind" | "elementId" | "action" | "written">[],
): Promise<boolean[]> {
  return inTransaction(organizationId, async (tx) => {
    const result: boolean[] = [];
    for (const item of items) {
      const current = await lineState(tx, item.elementId);
      result.push(current ? modifiedSince(current, item.written) || (item.action === "created" && (await hasAttachments(tx, item.elementId))) : false);
    }
    return result;
  });
}

// Une ligne créée par l'import puis complétée d'un devis joint (BUD-03), ou
// dont un montant a changé à la main, n'est annulée qu'avec confirmation.
export async function undoImportedBudgetElements(organizationId: string, userId: string, items: ImportUndoItem[]): Promise<ImportUndoOutcome[]> {
  return inTransaction(organizationId, async (tx) => {
    const outcomes: ImportUndoOutcome[] = [];
    for (const item of items) {
      const current = await lineState(tx, item.elementId);
      if (!current) {
        outcomes.push("missing");
        continue;
      }
      const modified = modifiedSince(current, item.written) || (item.action === "created" && (await hasAttachments(tx, item.elementId)));
      if (modified && !item.force) {
        outcomes.push("kept_modified");
        continue;
      }
      if (item.action === "created") {
        if (await hasAttachments(tx, item.elementId)) {
          // Un devis joint ne disparaît jamais avec une annulation d'import.
          outcomes.push("kept_in_use");
          continue;
        }
        await tx.delete(budgetLineHistory).where(inArray(budgetLineHistory.lineId, [item.elementId]));
        await tx.delete(budgetLines).where(eq(budgetLines.id, item.elementId));
      } else {
        const previous = item.previous ?? {};
        await tx
          .update(budgetLines)
          .set({ ...(previous as Partial<typeof budgetLines.$inferInsert>), updatedAt: new Date() })
          .where(eq(budgetLines.id, item.elementId));
        await history(tx, organizationId, item.elementId, userId, current, previous);
      }
      outcomes.push("undone");
    }
    return outcomes;
  });
}
