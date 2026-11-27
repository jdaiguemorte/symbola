// Lot 71a (BUD-01, HUB-14, C-56 ; spécification du lot 71, § 4.3 et § 5.1 ; ADR 0119) — le total « à
// répartir » d'un mariage repris, exposé par service.ts : ce que l'ancien outil donnait en un seul total
// (« 21 650,50 € engagés selon votre fichier, dont 3 200,00 € réglés »), sans le détail par prestataire.
// Le reste à répartir se calcule à chaque lecture : le total moins l'engagé des lignes du budget. Écrit
// par un import (une ligne du journal, annulable) ou fermé par la planner.
import { and, eq, isNull, sql } from "drizzle-orm";
import { sameImportValue, type ImportApplyResult, type ImportedItem, type ImportUndoItem, type ImportUndoOutcome } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { budgetLines, unallocatedTotals } from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

export const UNALLOCATED_TOTAL_KIND = "unallocated_total";

export type UnallocatedTotals = {
  committedCents: number;
  paidCents: number;
  currency: "EUR";
  // Engagé déjà réparti sur les lignes du budget, et ce qui reste (jamais négatif).
  allocatedCents: number;
  remainingCents: number;
  sourceImportId: string | null;
};

type Row = typeof unallocatedTotals.$inferSelect;

async function allocated(tx: Tx, eventId: string): Promise<number> {
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${budgetLines.committedAmountCents}), 0)::int` })
    .from(budgetLines)
    .where(and(eq(budgetLines.eventId, eventId), isNull(budgetLines.deletedAt)));
  return row?.total ?? 0;
}

async function view(tx: Tx, row: Row): Promise<UnallocatedTotals> {
  const allocatedCents = await allocated(tx, row.eventId);
  return { committedCents: row.committedCents, paidCents: row.paidCents, currency: "EUR", allocatedCents, remainingCents: Math.max(0, row.committedCents - allocatedCents), sourceImportId: row.sourceImportId };
}

export async function getUnallocatedTotals(organizationId: string, eventId: string): Promise<UnallocatedTotals | null> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const [row] = await tx.select().from(unallocatedTotals).where(eq(unallocatedTotals.eventId, eventId));
    return row ? view(tx, row) : null;
  });
}

function validAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

// Le total d'un mariage (une ligne au plus) : créée, ou remplacée. L'évènement est contrôlé par
// l'appelant (service des évènements) ; la ligne est écrite sous RLS, dans l'organisation.
export async function setUnallocatedTotals(
  organizationId: string,
  input: { eventId: string; committedCents: number; paidCents: number; sourceImportId?: string | null },
): Promise<UnallocatedTotals> {
  if (!validAmount(input.committedCents) || !validAmount(input.paidCents)) throw new Error("montant invalide");
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const [row] = await tx
      .insert(unallocatedTotals)
      .values({ organizationId, eventId: input.eventId, committedCents: input.committedCents, paidCents: input.paidCents, sourceImportId: input.sourceImportId ?? null })
      .onConflictDoUpdate({
        target: [unallocatedTotals.organizationId, unallocatedTotals.eventId],
        set: { committedCents: input.committedCents, paidCents: input.paidCents, sourceImportId: input.sourceImportId ?? null, updatedAt: new Date() },
      })
      .returning();
    return view(tx, row!);
  });
}

// La planner ferme le bandeau « à répartir » (lot 71f) : la ligne disparaît.
export async function closeUnallocatedTotals(organizationId: string, eventId: string): Promise<boolean> {
  return withOrganization(appDatabase(), organizationId, async (tx) => (await tx.delete(unallocatedTotals).where(eq(unallocatedTotals.eventId, eventId)).returning({ id: unallocatedTotals.id })).length > 0);
}

const state = (row: Row) => ({ eventId: row.eventId, committedCents: row.committedCents, paidCents: row.paidCents });

// Import (fiche PDF d'un logiciel) : un total par évènement, au journal pour être annulé.
export async function importUnallocatedTotals(
  organizationId: string,
  rows: { rowIndex: number; eventId: string; committedCents: number; paidCents: number }[],
  sourceImportId: string,
): Promise<ImportApplyResult> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const items: ImportedItem[] = [];
    let unchanged = 0;
    for (const row of rows) {
      if (!validAmount(row.committedCents) || !validAmount(row.paidCents)) continue;
      const [current] = await tx.select().from(unallocatedTotals).where(eq(unallocatedTotals.eventId, row.eventId));
      if (current && current.committedCents === row.committedCents && current.paidCents === row.paidCents) {
        unchanged += 1;
        continue;
      }
      const [written] = current
        ? await tx.update(unallocatedTotals).set({ committedCents: row.committedCents, paidCents: row.paidCents, sourceImportId, updatedAt: new Date() }).where(eq(unallocatedTotals.id, current.id)).returning()
        : await tx.insert(unallocatedTotals).values({ organizationId, eventId: row.eventId, committedCents: row.committedCents, paidCents: row.paidCents, sourceImportId }).returning();
      items.push({
        rowIndex: row.rowIndex,
        module: "budget",
        kind: UNALLOCATED_TOTAL_KIND,
        elementId: written!.id,
        action: current ? "updated" : "created",
        previous: current ? state(current) : null,
        written: state(written!),
      });
    }
    return { items, unchanged };
  });
}

function modified(current: Row, written: Record<string, unknown> | null): boolean {
  if (!written) return false;
  return !sameImportValue(current.committedCents, written.committedCents) || !sameImportValue(current.paidCents, written.paidCents);
}

export async function findModifiedUnallocatedTotals(tx: Tx, item: Pick<ImportUndoItem, "elementId" | "written">): Promise<boolean | null> {
  const [current] = await tx.select().from(unallocatedTotals).where(eq(unallocatedTotals.id, item.elementId));
  return current ? modified(current, item.written) : null;
}

export async function undoUnallocatedTotal(tx: Tx, item: ImportUndoItem): Promise<ImportUndoOutcome> {
  const [current] = await tx.select().from(unallocatedTotals).where(eq(unallocatedTotals.id, item.elementId));
  if (!current) return "missing";
  if (modified(current, item.written) && !item.force) return "kept_modified";
  if (item.action === "created") await tx.delete(unallocatedTotals).where(eq(unallocatedTotals.id, current.id));
  else {
    const previous = item.previous ?? {};
    await tx
      .update(unallocatedTotals)
      .set({ committedCents: Number(previous.committedCents ?? current.committedCents), paidCents: Number(previous.paidCents ?? current.paidCents), updatedAt: new Date() })
      .where(eq(unallocatedTotals.id, current.id));
  }
  return "undone";
}
