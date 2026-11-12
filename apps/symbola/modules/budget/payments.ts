// Lot 28b (BUD-03, décisions D12 et D13) — calculs des échéances des
// prestataires, sans accès aux données. Montants en centimes entiers ;
// pourcentages en points de base (10000 = 100 %), jamais de float (CLAUDE.md § 5).
import type { VendorPaymentStatus } from "@symbola/contracts";

type LineAmounts = { id: string; eventVendorSlotId: string; vendorCandidateId: string | null; committedAmountCents: number | null };
type PaymentAmounts = { fixedAmountCents: number | null; percentageBasisPoints: number | null; paidOn: string | null; dueOn: string };

// D12 : base d'une échéance en pourcentage = engagé du prestataire, toutes ses
// lignes de la catégorie ; pour une ligne sans prestataire, l'engagé de la ligne.
export function paymentBaseCents(line: LineAmounts, lines: LineAmounts[]): number {
  if (line.vendorCandidateId === null) return line.committedAmountCents ?? 0;
  return lines
    .filter((other) => other.eventVendorSlotId === line.eventVendorSlotId && other.vendorCandidateId === line.vendorCandidateId)
    .reduce((sum, other) => sum + (other.committedAmountCents ?? 0), 0);
}

// Arrondi au centime le plus proche, la moitié vers le haut (montants positifs).
export function percentageOfCents(baseCents: number, basisPoints: number): number {
  return Math.floor((baseCents * basisPoints + 5000) / 10000);
}

export function paymentAmountCents(payment: Pick<PaymentAmounts, "fixedAmountCents" | "percentageBasisPoints">, baseCents: number): number {
  if (payment.fixedAmountCents !== null) return payment.fixedAmountCents;
  return percentageOfCents(baseCents, payment.percentageBasisPoints ?? 0);
}

// Une échéance payée garde le montant figé au paiement (fixedAmountCents).
export function paidTotalCents(payments: PaymentAmounts[]): number {
  return payments.filter((payment) => payment.paidOn !== null).reduce((sum, payment) => sum + (payment.fixedAmountCents ?? 0), 0);
}

// Dates au format AAAA-MM-JJ : la comparaison de chaînes suit l'ordre des dates.
export function paymentStatus(payment: Pick<PaymentAmounts, "paidOn" | "dueOn">, today: string): VendorPaymentStatus {
  if (payment.paidOn !== null) return "paid";
  return payment.dueOn < today ? "overdue" : "due";
}

// Date AAAA-MM-JJ décalée de quelques jours (calendrier, sans fuseau).
export function addDaysTo(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
