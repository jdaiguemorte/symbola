// Lot 9 (ADR 0029) — statistiques d'usage pour l'Admin : un nombre par mois,
// jamais un nom, un montant ni un contenu ; les données d'essai (is_demo)
// sont toujours exclues.
export type MonthlyCount = {
  month: string; // AAAA-MM, mois civil Europe/Paris
  count: number;
};
