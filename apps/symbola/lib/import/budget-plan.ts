// Lot 71d (HUB-14, BUD-01, UX-07 ; spécification du lot 71, § 5.4 ; maquette 08, C-58) — ce qu'un budget
// importé va écrire, ligne par ligne, tel que l'écriront les modules : le poste de chaque ligne, ses
// montants, l'échéancier de ses acomptes et soldes (la même règle que l'écriture, `importedPaymentSchedule`
// du module budget), son prestataire et s'il est au carnet. « Vérifier » le montre poste par poste ; ses
// nombres viennent d'importFigures, gardés au journal à l'écriture et redits par le bilan.
import { depositPaidFor, importFigures, type BudgetImportFigures, type ImportAnswers, type ImportFigureBudgetLine } from "@symbola/contracts";
import type { ImportValue } from "@symbola/import-engine";
import { importedPaymentSchedule } from "@/modules/budget/service";
import { vendorLinkKey } from "@/modules/events/service";
import type { ImportMatching } from "@/modules/hub/service";

export type BudgetPlanRow = { rowIndex: number; lineNumber: number; values: Record<string, ImportValue>; slotId: string | null };

export type BudgetPlanLine = ImportFigureBudgetLine & {
  rowIndex: number;
  lineNumber: number;
  slotLabel: string;
  lineLabel: string | null;
  vendorName: string | null;
  // Prochaine échéance due de la ligne (AAAA-MM-JJ), s'il y en a une.
  nextDueOn: string | null;
};

export type BudgetPlan = { lines: BudgetPlanLine[]; figures: BudgetImportFigures };

const text = (value: ImportValue | undefined): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
const cents = (value: ImportValue | undefined): number | null => (typeof value === "number" && Number.isSafeInteger(value) ? value : null);

// Le prestataire de la ligne est-il au carnet (retrouvé, « C'est la même fiche », ou fiche créée) ?
export function vendorInCarnet(links: ImportMatching["vendorLinks"], name: string | null): boolean {
  if (!name) return false;
  const link = (links ?? []).find((entry) => vendorLinkKey(entry.name) === vendorLinkKey(name));
  return link !== undefined && (link.decision === "found" || link.decision === "same" || link.decision === "create");
}

export function budgetWritePlan(input: {
  rows: readonly BudgetPlanRow[];
  slotLabels: ReadonlyMap<string, string>;
  answers: ImportAnswers | null;
  vendorLinks: ImportMatching["vendorLinks"];
  // Noms au carnet des fiches retenues par « C'est la même fiche » (identifiant → nom).
  carnetNames?: ReadonlyMap<string, string>;
  paymentLabels: { deposit: string; balance: string };
  today: string;
}): BudgetPlan {
  const lines = input.rows.map((row): BudgetPlanLine => {
    const fileSlot = text(row.values.slotLabel) ?? "";
    const schedule = importedPaymentSchedule(row.values, input.paymentLabels, depositPaidFor(input.answers, row.rowIndex));
    const payments = (schedule?.payments ?? []).map((payment) => ({ amountCents: payment.fixedAmountCents, dueOn: payment.dueOn, paid: payment.paidOn !== null }));
    const fileVendor = text(row.values.vendorName);
    const link = fileVendor ? (input.vendorLinks ?? []).find((entry) => vendorLinkKey(entry.name) === vendorLinkKey(fileVendor)) : undefined;
    return {
      rowIndex: row.rowIndex,
      lineNumber: row.lineNumber,
      slotKey: row.slotId ?? `new:${vendorLinkKey(fileSlot)}`,
      newSlot: row.slotId === null,
      slotLabel: row.slotId ? (input.slotLabels.get(row.slotId) ?? fileSlot) : fileSlot,
      lineLabel: text(row.values.lineLabel),
      plannedCents: cents(row.values.plannedAmount),
      realCents: cents(row.values.actualAmount),
      paidCents: schedule ? null : cents(row.values.paidAmount),
      payments,
      vendorKey: fileVendor ? vendorLinkKey(fileVendor) : null,
      vendorInCarnet: vendorInCarnet(input.vendorLinks, fileVendor),
      vendorName: link?.decision === "same" && link.vendorId ? (input.carnetNames?.get(link.vendorId) ?? fileVendor) : fileVendor,
      nextDueOn: payments.filter((payment) => !payment.paid).map((payment) => payment.dueOn).sort()[0] ?? null,
    };
  });
  const figures = importFigures({ kind: "budget", lines }, input.today);
  if (figures.kind !== "budget") throw new Error("nombres d'un budget attendus");
  return { lines, figures };
}

// Le budget tel qu'il sera, poste par poste, dans l'ordre des lignes du fichier.
export function planBySlot(lines: readonly BudgetPlanLine[]): { slotKey: string; slotLabel: string; newSlot: boolean; lines: BudgetPlanLine[] }[] {
  const slots = new Map<string, { slotKey: string; slotLabel: string; newSlot: boolean; lines: BudgetPlanLine[] }>();
  for (const line of lines) {
    const slot = slots.get(line.slotKey) ?? { slotKey: line.slotKey, slotLabel: line.slotLabel, newSlot: line.newSlot, lines: [] };
    slot.lines.push(line);
    slots.set(line.slotKey, slot);
  }
  return [...slots.values()];
}
