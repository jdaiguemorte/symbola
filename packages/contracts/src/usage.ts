// Lot 9 (ADR 0029) — statistiques d'usage pour l'Admin : un nombre par mois,
// jamais un nom, un montant ni un contenu ; les données d'essai (is_demo)
// sont toujours exclues.
export type MonthlyCount = {
  month: string; // AAAA-MM, mois civil Europe/Paris
  count: number;
};

// Lot 37b (DOC-12 ; D12, D13, ADR 0071) — relevé du stockage, par nature : originaux légaux
// (factures et avoirs émis), documents signés (devis et contrats signés, dossiers de preuve), dépôts
// (documents de l'évènement, pièces des tâches et du budget, devis des candidats, fichiers du
// carnet) et images (logo, images déposées). Les exports, temporaires, ne comptent pas.
export const STORAGE_NATURES = ["legal_originals", "signed_documents", "uploads", "images"] as const;
export type StorageNature = (typeof STORAGE_NATURES)[number];

// Ce que chaque module rend au relevé : des sommes par nature et par évènement (null hors
// évènement), pour écarter les évènements d'essai (is_demo). Jamais un nom de fichier.
export type StorageUsageRow = { nature: StorageNature; eventId: string | null; files: number; bytes: number };
