// PRD-BUD-01 — arithmétique pure de la simulation : répartition d'un montant
// total par poste depuis un modèle en pourcentages, total/reste à
// répartir, coût par invité. Centimes entiers EUR, points de base entiers
// pour les pourcentages (0 à 10000 = 0,00 % à 100,00 %) — jamais de float
// (CLAUDE.md §5).
const TOTAL_BASIS_POINTS = 10000;

export type AllocationModelItem = { defaultVendorSlotId: string; percentageBasisPoints: number };
export type EventBudgetItem = { defaultVendorSlotId: string; amountCents: number };

// PRD-BUD-01 : « étant donné un modèle dont le total ne fait pas 100 %, alors
// l'app l'affiche en alerte et refuse de l'enregistrer. »
export function sumBasisPoints(items: { percentageBasisPoints: number }[]): number {
  return items.reduce((sum, item) => sum + item.percentageBasisPoints, 0);
}

export function isModelTotalValid(items: { percentageBasisPoints: number }[]): boolean {
  return sumBasisPoints(items) === TOTAL_BASIS_POINTS;
}

// Répartit totalAmountCents selon les pourcentages du modèle. L'arrondi
// (floor) peut laisser un reliquat de quelques centimes, affecté au
// dernier poste pour que la somme des montants égale exactement le total
// — jamais de centime perdu par arrondi.
export function allocateFromModel(totalAmountCents: number, items: AllocationModelItem[]): EventBudgetItem[] {
  if (items.length === 0) return [];
  const allocated = items.map((item) => ({
    defaultVendorSlotId: item.defaultVendorSlotId,
    amountCents: Math.floor((totalAmountCents * item.percentageBasisPoints) / TOTAL_BASIS_POINTS),
  }));
  const distributed = allocated.reduce((sum, item) => sum + item.amountCents, 0);
  const remainder = totalAmountCents - distributed;
  if (remainder !== 0) {
    const last = allocated[allocated.length - 1]!;
    last.amountCents += remainder;
  }
  return allocated;
}

export function sumAmountCents(items: EventBudgetItem[]): number {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

export function remainingToAllocateCents(totalAmountCents: number, items: EventBudgetItem[]): number {
  return totalAmountCents - sumAmountCents(items);
}

// PRD-BUD-02 — écart = réel moins prévu, en centimes et en pourcentage du
// prévu. Nul tant qu'aucun montant réel n'est renseigné (jamais 0 par
// défaut, qui laisserait croire à un écart nul constaté). 0 % si le
// prévu est à 0 (pas de division par zéro affichée).
// Lot 28a (BUD-01) : l'écart est celui de l'engagé à l'estimé (autrefois du
// réel au prévu).
export function computeVariance(
  estimatedAmountCents: number | null,
  committedAmountCents: number | null,
): { varianceCents: number | null; variancePercent: number | null } {
  // Lot 12 : sans estimé (ligne suivie seulement en engagé), pas d'écart.
  if (committedAmountCents === null || estimatedAmountCents === null) return { varianceCents: null, variancePercent: null };
  const varianceCents = committedAmountCents - estimatedAmountCents;
  const variancePercent = estimatedAmountCents === 0 ? 0 : Math.round((varianceCents / estimatedAmountCents) * 10000) / 100;
  return { varianceCents, variancePercent };
}

// Lot 28a (BUD-01) : reste à payer, engagé moins payé ; null sans engagé.
export function remainingToPayCents(committedAmountCents: number | null, paidAmountCents: number | null): number | null {
  return committedAmountCents === null ? null : committedAmountCents - (paidAmountCents ?? 0);
}

// Lot 28a (BUD-02) : seuil en centimes, et part engagée de l'enveloppe en
// pourcentage (arrondie à l'unité).
export function envelopeThresholdCents(envelopeCents: number, thresholdPercent: number): number {
  return Math.floor((envelopeCents * thresholdPercent) / 100);
}

export function shareOfEnvelopePercent(amountCents: number, envelopeCents: number): number {
  return envelopeCents === 0 ? 0 : Math.round((amountCents / envelopeCents) * 100);
}

// 0 si guestCount est 0 : jamais de division par zéro affichée à l'écran.
export function costPerGuestCents(totalAmountCents: number, guestCount: number): number {
  if (guestCount <= 0) return 0;
  return Math.round(totalAmountCents / guestCount);
}
