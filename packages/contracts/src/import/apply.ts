// Lot 5 (IMP-05) — contrat entre l'orchestrateur de l'import et les modules
// qui reçoivent les lignes (ADR 0022) : chaque module écrit un lot de lignes
// en une transaction et renvoie, pour chaque élément touché, de quoi
// l'annuler (valeurs précédentes) et détecter une modification à la main
// depuis l'import (valeurs écrites). Futur contrat HTTP /v1/.../imports.

export type ImportCellValue = string | number | boolean | null;

export type ImportApplyRow = {
  rowIndex: number;
  // Valeurs typées par clé de champ (IMPORT_FIELDS) ; null = cellule vide,
  // qui ne remplace jamais une valeur existante.
  values: Record<string, ImportCellValue>;
  // Colonnes gardées en champ libre (intitulé → texte).
  importedFields: Record<string, string>;
  // Élément existant rapproché (IMP-03) : la ligne le met à jour.
  matchId: string | null;
  // Tâche ou ligne de budget : événement de rattachement.
  eventId: string | null;
};

export type ImportedItem = {
  rowIndex: number | null;
  module: "events" | "budget" | "quotes" | "vendors";
  // Nature de l'élément, propre au module (event, task, catalog_item…).
  kind: string;
  elementId: string;
  action: "created" | "updated";
  previous: Record<string, unknown> | null;
  written: Record<string, unknown>;
};

export type ImportApplyResult = {
  items: ImportedItem[];
  // Lignes rapprochées dont aucune valeur ne change.
  unchanged: number;
};

// Annulation d'un élément : fait, gardé car modifié à la main depuis
// l'import (sauf confirmation), gardé car utilisé ailleurs (jamais supprimé),
// ou déjà supprimé.
export type ImportUndoOutcome = "undone" | "kept_modified" | "kept_in_use" | "missing";

export type ImportUndoItem = Pick<ImportedItem, "kind" | "elementId" | "action" | "previous" | "written"> & { force: boolean };
