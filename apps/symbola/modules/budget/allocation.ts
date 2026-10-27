// BUD-01 — arithmétique pure de la simulation : répartition d'un montant
// total par poste depuis un modèle en pourcentages, total/reste à
// répartir, coût par invité. Centimes entiers EUR, points de base entiers
// pour les pourcentages (0 à 10000 = 0,00 % à 100,00 %) — jamais de float
// (CLAUDE.md §5).
const TOTAL_BASIS_POINTS = 10000;

export type AllocationModelItem = { defaultVendorSlotId: string; percentageBasisPoints: number };
export type EventBudgetItem = { defaultVendorSlotId: string; amountCents: number };

// BUD-01 : « étant donné un modèle dont le total ne fait pas 100 %, alors
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

// BUD-02 — écart = réel moins prévu, en centimes et en pourcentage du
// prévu. Nul tant qu'aucun montant réel n'est renseigné (jamais 0 par
// défaut, qui laisserait croire à un écart nul constaté). 0 % si le
// prévu est à 0 (pas de division par zéro affichée).
export function computeVariance(
  plannedAmountCents: number,
  actualAmountCents: number | null,
): { varianceCents: number | null; variancePercent: number | null } {
  if (actualAmountCents === null) return { varianceCents: null, variancePercent: null };
  const varianceCents = actualAmountCents - plannedAmountCents;
  const variancePercent = plannedAmountCents === 0 ? 0 : Math.round((varianceCents / plannedAmountCents) * 10000) / 100;
  return { varianceCents, variancePercent };
}

// 0 si guestCount est 0 : jamais de division par zéro affichée à l'écran.
export function costPerGuestCents(totalAmountCents: number, guestCount: number): number {
  if (guestCount <= 0) return 0;
  return Math.round(totalAmountCents / guestCount);
}
