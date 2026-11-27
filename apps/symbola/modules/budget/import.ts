// IMP-05 — import de lignes de budget (lot 5, ADR 0022), exposé par
// service.ts. Une ligne de budget est portée par un poste de l'événement
// (module events, PRD-BUD-02) : le poste est d'abord créé ou mis à jour par le
// service du module events, puis les montants sont écrits ici en une
// transaction, historisés comme une saisie à la main. Si cette seconde
// écriture échoue, les postes écrits sont annulés (compensation : deux
// modules, deux transactions).
import { and, asc, eq, inArray, notInArray, sql } from "drizzle-orm";
import { depositPaidFor, sameImportValue, type ImportAnswers, type ImportApplyResult, type ImportApplyRow, type ImportedItem, type ImportUndoItem, type ImportUndoOutcome } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { budgetLineAttachments, budgetLineHistory, budgetLines, vendorPayments } from "@symbola/db/schema/budget";
import { withOrganization } from "@symbola/db/with-organization";
import { importVendorSlotsForBudget, undoImportedEventsElements } from "@/modules/events/service";
import { findModifiedUnallocatedTotals, UNALLOCATED_TOTAL_KIND, undoUnallocatedTotal } from "./unallocated";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type Values = Record<string, unknown>;

async function inTransaction<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

function amount(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

async function lineState(tx: Tx, lineId: string): Promise<Values | null> {
  const [line] = await tx.select().from(budgetLines).where(eq(budgetLines.id, lineId));
  if (!line) return null;
  return {
    estimatedAmountCents: line.estimatedAmountCents,
    quotedAmountCents: line.quotedAmountCents,
    committedAmountCents: line.committedAmountCents,
    paidAmountCents: line.paidAmountCents,
    vendorCandidateId: line.vendorCandidateId,
  };
}

// Lot 63b (BUD-01, BUD-03, HUB-14) — un acompte et un solde datés deviennent les échéances de la
// ligne. Le réglé du fichier dit lesquelles sont payées (dans l'ordre : rien, l'acompte, ou les
// deux ; payée à sa date). Une échéance sans date, ou un réglé qui ne tombe pas sur une échéance,
// et l'import fait comme avant : le réglé va sur la ligne, sans échéance (rien n'est inventé).
export type ImportedPayment = { label: string; fixedAmountCents: number; dueOn: string; paidOn: string | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = (value: unknown): string | null => (typeof value === "string" && ISO_DATE.test(value) ? value : null);

// Lot 71a (HUB-14 ; spécification du lot 71, § 5.1) : `depositPaid`, la réponse à « Les montants de
// l'acompte ont-ils été payés ? » pour cette ligne. Oui : l'acompte est une échéance payée à sa date ;
// non : une échéance due ; null (question non posée) : la règle d'avant, le réglé du fichier.
export function importedPaymentSchedule(
  values: Values,
  labels: { deposit: string; balance: string },
  depositPaid: boolean | null = null,
): { payments: ImportedPayment[]; paidAmountCents: number } | null {
  const parts: { kind: "deposit" | "balance"; label: string; amount: number | null; dueOn: string | null }[] = [
    { kind: "deposit" as const, label: labels.deposit, amount: amount(values.depositAmount), dueOn: isoDate(values.depositDueOn) },
    { kind: "balance" as const, label: labels.balance, amount: amount(values.balanceAmount), dueOn: isoDate(values.balanceDueOn) },
  ].filter((part) => part.amount !== null || part.dueOn !== null);
  if (parts.length === 0 || parts.some((part) => part.amount === null || part.amount <= 0 || part.dueOn === null)) return null;
  let covered = 0;
  let paidCount = 0;
  if (depositPaid !== null) {
    if (depositPaid && parts[0]?.kind === "deposit") {
      covered = parts[0].amount!;
      paidCount = 1;
    }
  } else {
    const paid = amount(values.paidAmount) ?? 0;
    if (paid > 0) {
      for (const part of parts) {
        covered += part.amount!;
        paidCount += 1;
        if (covered >= paid) break;
      }
      if (covered !== paid) return null;
    }
  }
  return {
    payments: parts.map((part, index) => ({ label: part.label, fixedAmountCents: part.amount!, dueOn: part.dueOn!, paidOn: index < paidCount ? part.dueOn! : null })),
    paidAmountCents: covered,
  };
}

type RecordedPayment = ImportedPayment & { id: string };

function recordedPayments(values: Values | null): RecordedPayment[] {
  const list = values?.payments;
  return Array.isArray(list) ? (list as RecordedPayment[]).filter((payment) => typeof payment?.id === "string") : [];
}

// Les échéances créées par l'import, telles qu'il les a écrites ? Sinon la ligne a été retouchée.
async function paymentsUnchanged(tx: Tx, recorded: RecordedPayment[]): Promise<boolean> {
  if (recorded.length === 0) return true;
  const rows = await tx.select().from(vendorPayments).where(inArray(vendorPayments.id, recorded.map((payment) => payment.id)));
  return recorded.every((payment) => {
    const row = rows.find((candidate) => candidate.id === payment.id);
    return row !== undefined && row.fixedAmountCents === payment.fixedAmountCents && row.dueOn === payment.dueOn && (row.paidOn ?? null) === payment.paidOn;
  });
}

async function insertPayments(tx: Tx, organizationId: string, eventId: string, lineId: string, payments: ImportedPayment[]): Promise<RecordedPayment[]> {
  const recorded: RecordedPayment[] = [];
  for (const [position, payment] of payments.entries()) {
    const [row] = await tx
      .insert(vendorPayments)
      .values({ organizationId, eventId, lineId, label: payment.label, fixedAmountCents: payment.fixedAmountCents, dueOn: payment.dueOn, paidOn: payment.paidOn, position })
      .returning({ id: vendorPayments.id });
    recorded.push({ id: row!.id, ...payment });
  }
  return recorded;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Lot 28b (BUD-01, Q33) : la ligne d'un libellé importé dans la catégorie
// (créée s'il n'y en a pas), ou, sans libellé, la première de la catégorie.
// Lot 71a (HUB-14 ; § 5.1) : jamais fondues — une ligne déjà écrite par une ligne précédente du même
// fichier (`written`) n'est plus une cible ; la ligne suivante du fichier en crée une autre.
export function pickTargetLine<T extends { id: string; label: string; position: number }>(lines: readonly T[], label: string | null, written: ReadonlySet<string>): { line: T | null; position: number } {
  const free = lines.filter((line) => !written.has(line.id));
  const next = lines.reduce((max, line) => Math.max(max, line.position + 1), 0);
  if (label === null) return { line: free[0] ?? null, position: free[0] ? 0 : next };
  const same = free.find((line) => line.label.trim().toLowerCase() === label.toLowerCase());
  return { line: same ?? null, position: next };
}

async function targetLine(tx: Tx, slotId: string, label: string | null, written: ReadonlySet<string>) {
  const lines = await tx.select().from(budgetLines).where(eq(budgetLines.eventVendorSlotId, slotId)).orderBy(asc(budgetLines.position), asc(budgetLines.createdAt));
  return pickTargetLine(lines, label, written);
}

// Lot 28a (BUD-01, décision D2) : un import fait avant le lot garde les anciens
// noms (prévu, réel) dans sa trace ; ils deviennent l'estimé et l'engagé pour
// comparer et annuler.
const LEGACY_KEYS: Record<string, string> = { plannedAmountCents: "estimatedAmountCents", actualAmountCents: "committedAmountCents" };

function currentKeys(values: Values | null): Values | null {
  return values === null ? null : Object.fromEntries(Object.entries(values).map(([key, value]) => [LEGACY_KEYS[key] ?? key, value]));
}

async function history(tx: Tx, organizationId: string, lineId: string, userId: string, before: Values, after: Values): Promise<void> {
  for (const [field, key] of [
    ["estimated", "estimatedAmountCents"],
    ["quoted", "quotedAmountCents"],
    ["committed", "committedAmountCents"],
    ["paid", "paidAmountCents"],
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

export async function importBudgetLineRows(input: {
  organizationId: string;
  userId: string;
  rows: ImportApplyRow[];
  // Lot 63b : libellés des échéances créées (langue de l'organisation).
  paymentLabels?: { deposit: string; balance: string };
  // Lot 71a (HUB-14) : réponses de l'étape « Questions » (acomptes payés, contrats signés), et import
  // d'une reprise ; sans elles, les règles d'avant.
  answers?: ImportAnswers | null;
  takeover?: boolean;
}): Promise<ImportApplyResult> {
  const labels = input.paymentLabels ?? { deposit: "Acompte", balance: "Solde" };
  const slots = await importVendorSlotsForBudget({ organizationId: input.organizationId, rows: input.rows, answers: input.answers ?? null, takeover: input.takeover ?? false });
  try {
    const result = await inTransaction(input.organizationId, async (tx) => {
      const items: ImportedItem[] = [];
      let unchanged = 0;
      // Lot 71a : les lignes déjà écrites par ce fichier ne sont plus des cibles (jamais fondues).
      const fileLines = new Set<string>();
      for (const row of input.rows) {
        const slotId = slots.slotIdByRow.get(row.rowIndex);
        if (!slotId || !row.eventId) throw new Error("poste de la ligne introuvable");
        // Colonnes du tableur « prévu » et « réel » : l'estimé et l'engagé (lot 28a).
        const planned = amount(row.values.plannedAmount);
        const actual = amount(row.values.actualAmount);
        const label = text(row.values.lineLabel);
        const candidateId = slots.candidateIdByRow.get(row.rowIndex) ?? null;
        // Lot 63b : un « réel » est aussi un montant devisé (« Réel » à l'écran) ; le réglé, ou les
        // échéances datées qui le portent.
        const schedule = importedPaymentSchedule(row.values, labels, depositPaidFor(input.answers, row.rowIndex));
        const paidOnly = schedule ? null : amount(row.values.paidAmount);
        const { line: existing, position } = await targetLine(tx, slotId, label, fileLines);
        if (existing) {
          fileLines.add(existing.id);
          const current = {
            estimatedAmountCents: existing.estimatedAmountCents,
            quotedAmountCents: existing.quotedAmountCents,
            committedAmountCents: existing.committedAmountCents,
            paidAmountCents: existing.paidAmountCents,
            vendorCandidateId: existing.vendorCandidateId,
          };
          const [anyPayment] = await tx.select({ id: vendorPayments.id }).from(vendorPayments).where(eq(vendorPayments.lineId, existing.id)).limit(1);
          const written: Values = {};
          if (planned !== null && planned !== current.estimatedAmountCents) written.estimatedAmountCents = planned;
          if (actual !== null && actual !== current.committedAmountCents) written.committedAmountCents = actual;
          if (actual !== null && current.quotedAmountCents === null) written.quotedAmountCents = actual;
          if (candidateId !== null && current.vendorCandidateId === null) written.vendorCandidateId = candidateId;
          // Une ligne qui a déjà ses échéances garde son réglé : il se calcule d'elles.
          const newSchedule = schedule && !anyPayment ? schedule : null;
          if (newSchedule && newSchedule.paidAmountCents !== (current.paidAmountCents ?? null)) written.paidAmountCents = newSchedule.paidAmountCents;
          if (!newSchedule && !anyPayment && paidOnly !== null && paidOnly !== current.paidAmountCents) written.paidAmountCents = paidOnly;
          if (Object.keys(written).length === 0 && !newSchedule) {
            if (!slots.items.some((item) => item.rowIndex === row.rowIndex)) unchanged += 1;
            continue;
          }
          if (Object.keys(written).length > 0) {
            await tx
              .update(budgetLines)
              .set({ ...(written as Partial<typeof budgetLines.$inferInsert>), updatedAt: new Date() })
              .where(eq(budgetLines.id, existing.id));
            await history(tx, input.organizationId, existing.id, input.userId, current, written);
          }
          const previous = Object.fromEntries(Object.keys(written).map((key) => [key, current[key as keyof typeof current]]));
          if (newSchedule) written.payments = await insertPayments(tx, input.organizationId, row.eventId, existing.id, newSchedule.payments);
          items.push({ rowIndex: row.rowIndex, module: "budget", kind: "budget_line", elementId: existing.id, action: "updated", previous, written });
          continue;
        }
        const [line] = await tx
          .insert(budgetLines)
          .values({
            organizationId: input.organizationId,
            eventId: row.eventId,
            eventVendorSlotId: slotId,
            label: label ?? "",
            vendorCandidateId: candidateId,
            position,
            estimatedAmountCents: planned,
            quotedAmountCents: actual,
            committedAmountCents: actual,
            paidAmountCents: schedule ? schedule.paidAmountCents : paidOnly,
          })
          .returning();
        if (!line) throw new Error("création de la ligne de budget échouée");
        fileLines.add(line.id);
        const lineWritten: Values = {
          estimatedAmountCents: line.estimatedAmountCents,
          quotedAmountCents: line.quotedAmountCents,
          committedAmountCents: line.committedAmountCents,
          paidAmountCents: line.paidAmountCents,
          vendorCandidateId: line.vendorCandidateId,
        };
        await history(tx, input.organizationId, line.id, input.userId, { estimatedAmountCents: null, quotedAmountCents: null, committedAmountCents: null, paidAmountCents: null }, lineWritten);
        if (schedule) lineWritten.payments = await insertPayments(tx, input.organizationId, row.eventId, line.id, schedule.payments);
        items.push({ rowIndex: row.rowIndex, module: "budget", kind: "budget_line", elementId: line.id, action: "created", previous: null, written: lineWritten });
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

function modifiedSince(current: Values, recorded: Values | null): boolean {
  const written = currentKeys(recorded) ?? {};
  return Object.keys(written).some((key) => key !== "payments" && !sameImportValue(current[key], written[key]));
}

// Un document joint ou une échéance (lot 28b) : la ligne a reçu du travail à la main. Les échéances
// créées par l'import lui-même (lot 63b) ne comptent pas, tant qu'elles n'ont pas été retouchées.
async function hasAttachments(tx: Tx, lineId: string, imported: RecordedPayment[] = []): Promise<boolean> {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` }).from(budgetLineAttachments).where(eq(budgetLineAttachments.lineId, lineId));
  const own = imported.map((payment) => payment.id);
  const [payment] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(vendorPayments)
    .where(and(eq(vendorPayments.lineId, lineId), own.length > 0 ? notInArray(vendorPayments.id, own) : undefined));
  return (row?.n ?? 0) + (payment?.n ?? 0) > 0;
}

async function lineModified(tx: Tx, item: Pick<ImportUndoItem, "elementId" | "action" | "written">, current: Values): Promise<boolean> {
  const imported = recordedPayments(item.written);
  if (modifiedSince(current, item.written)) return true;
  if (!(await paymentsUnchanged(tx, imported))) return true;
  return item.action === "created" && (await hasAttachments(tx, item.elementId, imported));
}

export async function findModifiedImportedBudgetElements(
  organizationId: string,
  items: Pick<ImportUndoItem, "kind" | "elementId" | "action" | "written">[],
): Promise<boolean[]> {
  return inTransaction(organizationId, async (tx) => {
    const result: boolean[] = [];
    for (const item of items) {
      // Lot 71a : le total « à répartir » d'une fiche reprise.
      if (item.kind === UNALLOCATED_TOTAL_KIND) {
        result.push((await findModifiedUnallocatedTotals(tx, item)) ?? false);
        continue;
      }
      const current = await lineState(tx, item.elementId);
      result.push(current ? await lineModified(tx, item, current) : false);
    }
    return result;
  });
}

// Une ligne créée par l'import puis complétée d'un devis joint (PRD-BUD-03), ou
// dont un montant a changé à la main, n'est annulée qu'avec confirmation.
export async function undoImportedBudgetElements(organizationId: string, userId: string, items: ImportUndoItem[]): Promise<ImportUndoOutcome[]> {
  return inTransaction(organizationId, async (tx) => {
    const outcomes: ImportUndoOutcome[] = [];
    for (const item of items) {
      if (item.kind === UNALLOCATED_TOTAL_KIND) {
        outcomes.push(await undoUnallocatedTotal(tx, item));
        continue;
      }
      const current = await lineState(tx, item.elementId);
      if (!current) {
        outcomes.push("missing");
        continue;
      }
      const modified = await lineModified(tx, item, current);
      if (modified && !item.force) {
        outcomes.push("kept_modified");
        continue;
      }
      const imported = recordedPayments(item.written);
      if (item.action === "created") {
        if (await hasAttachments(tx, item.elementId, imported)) {
          // Un devis joint ne disparaît jamais avec une annulation d'import.
          outcomes.push("kept_in_use");
          continue;
        }
        if (imported.length > 0) await tx.delete(vendorPayments).where(inArray(vendorPayments.id, imported.map((payment) => payment.id)));
        await tx.delete(budgetLineHistory).where(inArray(budgetLineHistory.lineId, [item.elementId]));
        await tx.delete(budgetLines).where(eq(budgetLines.id, item.elementId));
      } else {
        // Les échéances créées par l'import partent avec lui ; la ligne retrouve ses montants.
        if (imported.length > 0) await tx.delete(vendorPayments).where(inArray(vendorPayments.id, imported.map((payment) => payment.id)));
        const previous = currentKeys(item.previous ?? {}) ?? {};
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
