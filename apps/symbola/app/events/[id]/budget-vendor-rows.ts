// Lot 63c (BUD-01, BUD-03, BUD-04 ; Q42, maquette M9) — l'onglet « Budget et prestataires » en une
// seule vue : une ligne par poste, avec prévu, réel, écart (réel − prévu), réglé, reste à payer et
// prochaine échéance ; l'engagé en pastille et en sous-total « dont engagé ». Règles pures, testées
// avec une horloge simulée (`today`, date de Paris).
import type { BudgetLine, BudgetLineAttachment, EventVendorSlot, VendorPayment } from "@symbola/contracts";
// Fichier sans base du module Budget : ce calcul sert aussi dans les composants du navigateur.
import { slotActualCents } from "@/modules/budget/actual";

export type RowPayment = VendorPayment & { lineLabel: string; late: boolean };
export type RowAttachment = BudgetLineAttachment & { lineId: string; lineLabel: string };

export type BudgetVendorRow = {
  slotId: string;
  label: string;
  icon: string | null;
  status: EventVendorSlot["status"];
  vendorNames: string[];
  lines: BudgetLine[];
  plannedCents: number | null;
  // Réel (« Devisé » jusqu'au lot 63) : le devis des lignes, à défaut l'engagé, à défaut le devis des
  // prestataires retenus.
  actualCents: number | null;
  varianceCents: number | null;
  paidCents: number;
  remainingCents: number | null;
  nextPayment: RowPayment | null;
  // Rien ne reste à payer sur un réel connu et réglé.
  settled: boolean;
  // Devis accepté ou contrat signé : la ligne a un engagé (BUD-01, SC-04).
  engaged: boolean;
  engagedCents: number;
  payments: RowPayment[];
  attachments: RowAttachment[];
};

export type BudgetVendorTotals = {
  plannedCents: number;
  actualCents: number;
  // Sur les lignes qui ont un réel et un prévu.
  varianceCents: number;
  paidCents: number;
  remainingCents: number;
  engagedCents: number;
};

function sumOf(values: (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length > 0 ? known.reduce((sum, value) => sum + value, 0) : null;
}

export function buildBudgetVendorRows(slots: EventVendorSlot[], categories: { eventVendorSlotId: string; lines: BudgetLine[] }[], today: string): { rows: BudgetVendorRow[]; totals: BudgetVendorTotals } {
  const rows = slots.map((slot): BudgetVendorRow => {
    const lines = categories.find((category) => category.eventVendorSlotId === slot.id)?.lines ?? [];
    const plannedCents = sumOf(lines.map((line) => line.estimatedAmountCents));
    const retained = sumOf(slot.retainedVendors.map((vendor) => vendor.quoteAmountCents));
    // Lot 73a (P9) : le même calcul que le montant d'un mariage sur la fiche d'un prestataire.
    const actualCents = slotActualCents(lines) ?? retained;
    const paidCents = sumOf(lines.map((line) => line.paidAmountCents)) ?? 0;
    const payments = lines
      .flatMap((line) => line.payments.map((payment) => ({ ...payment, lineLabel: line.label, late: payment.status !== "paid" && payment.dueOn < today })))
      .sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.label.localeCompare(b.label));
    const remainingCents = actualCents !== null ? actualCents - paidCents : null;
    return {
      slotId: slot.id,
      label: slot.label,
      icon: slot.icon,
      status: slot.status,
      vendorNames: [...new Set([...slot.retainedVendors.map((vendor) => vendor.vendorName), ...lines.flatMap((line) => (line.vendorName ? [line.vendorName] : []))])],
      lines,
      plannedCents,
      actualCents,
      varianceCents: plannedCents !== null && actualCents !== null ? actualCents - plannedCents : null,
      paidCents,
      remainingCents,
      nextPayment: payments.find((payment) => payment.status !== "paid") ?? null,
      settled: actualCents !== null && paidCents > 0 && (remainingCents ?? 0) <= 0,
      engaged: lines.some((line) => line.committedAmountCents !== null),
      engagedCents: sumOf(lines.map((line) => line.committedAmountCents)) ?? 0,
      payments,
      attachments: lines.flatMap((line) => line.attachments.map((attachment) => ({ ...attachment, lineId: line.id, lineLabel: line.label }))),
    };
  });
  const totals: BudgetVendorTotals = {
    plannedCents: rows.reduce((sum, row) => sum + (row.plannedCents ?? 0), 0),
    actualCents: rows.reduce((sum, row) => sum + (row.actualCents ?? 0), 0),
    varianceCents: rows.reduce((sum, row) => sum + (row.varianceCents ?? 0), 0),
    paidCents: rows.reduce((sum, row) => sum + row.paidCents, 0),
    remainingCents: rows.reduce((sum, row) => sum + (row.remainingCents ?? 0), 0),
    engagedCents: rows.reduce((sum, row) => sum + row.engagedCents, 0),
  };
  return { rows, totals };
}

// L'écart avec son signe toujours écrit (« + 400 € », « − 300 € ») : la couleur n'est qu'un renfort.
export function signedAmount(cents: number, format: (cents: number) => string): string {
  if (cents > 0) return `+ ${format(cents)}`;
  if (cents < 0) return `− ${format(-cents)}`;
  return format(0);
}
