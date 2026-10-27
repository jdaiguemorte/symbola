// BUD-02/04 — présentation de l'écart réel − prévu, partagée entre le
// tableau de la planner et la vue en lecture seule du marié. Le texte porte
// l'information (dépassement, économie), la couleur n'est qu'un renfort
// (accessibilité, axe-core).
export type VarianceDisplay = {
  labelKey: "varianceUnset" | "varianceOver" | "varianceUnder" | "varianceEqual";
  amountCents: number | null;
  color: string | undefined;
};

export function varianceDisplay(varianceCents: number | null): VarianceDisplay {
  if (varianceCents === null) return { labelKey: "varianceUnset", amountCents: null, color: undefined };
  if (varianceCents > 0) return { labelKey: "varianceOver", amountCents: varianceCents, color: "#b91c1c" };
  if (varianceCents < 0) return { labelKey: "varianceUnder", amountCents: -varianceCents, color: "#15803d" };
  return { labelKey: "varianceEqual", amountCents: null, color: undefined };
}
