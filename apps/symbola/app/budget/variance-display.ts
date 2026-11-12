// PRD-BUD-02/04 — présentation de l'écart engagé − estimé (lot 28a), partagée entre le
// tableau de la planner et la vue en lecture seule du marié. Le texte porte
// l'information (dépassement, économie), la couleur n'est qu'un renfort
// (accessibilité, axe-core).
export type VarianceDisplay = {
  labelKey: "varianceUnset" | "varianceOver" | "varianceUnder" | "varianceEqual";
  amountCents: number | null;
  // Classe de la charte (globals.css) : renfort visuel du libellé.
  className: string | undefined;
};

export function varianceDisplay(varianceCents: number | null): VarianceDisplay {
  if (varianceCents === null) return { labelKey: "varianceUnset", amountCents: null, className: undefined };
  if (varianceCents > 0) return { labelKey: "varianceOver", amountCents: varianceCents, className: "text-overdue" };
  if (varianceCents < 0) return { labelKey: "varianceUnder", amountCents: -varianceCents, className: "text-paid" };
  return { labelKey: "varianceEqual", amountCents: null, className: undefined };
}
