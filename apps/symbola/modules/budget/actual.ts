// Lot 73a (BUD-01, PRE-08 ; décision P9 de Julien du 27/11/2026) — le réel d'un poste : la somme, ligne par
// ligne, du devis, à défaut de l'engagé. Même calcul pour la colonne « Réel » du budget et pour le montant
// d'un mariage sur la fiche d'un prestataire (C-48 : un poste à deux lignes compte les deux). Sans base.
import type { BudgetLine } from "@symbola/contracts";

export function slotActualCents(lines: Pick<BudgetLine, "quotedAmountCents" | "committedAmountCents">[]): number | null {
  const known = lines.map((line) => line.quotedAmountCents ?? line.committedAmountCents).filter((value): value is number => value !== null);
  return known.length > 0 ? known.reduce((sum, value) => sum + value, 0) : null;
}
