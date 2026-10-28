// Résultat de la lecture d'un fichier d'import (IMP-01). Toutes les cellules
// sont du texte : l'analyse des dates et montants vient à l'étape des
// colonnes (IMP-02), sur la colonne entière.

export type ImportFormat = "csv" | "xlsx" | "json";
export type TextEncoding = "utf-8" | "windows-1252" | "utf-16le" | "utf-16be";
export type Delimiter = "," | ";" | "\t";

export type ImportTable = {
  format: ImportFormat;
  // Texte délimité seulement.
  encoding?: TextEncoding;
  delimiter?: Delimiter;
  // Index (0 = première ligne du fichier) de la ligne d'en-tête retenue ;
  // -1 si aucune ligne n'a l'allure d'un en-tête (colonnes sans intitulé).
  headerRowIndex: number;
  // Un intitulé par colonne ; "" pour une colonne sans intitulé.
  headers: string[];
  // Lignes de données, chacune de la longueur de `headers` ; les lignes
  // entièrement vides sont retirées.
  rows: string[][];
  // Numéro de ligne d'origine (1 = première ligne du fichier) de chaque
  // ligne de `rows`, pour le rapport des écarts (IMP-04).
  sourceLineNumbers: number[];
  // Nombre de cellules neutralisées (protection contre l'injection de formules).
  neutralizedCells: number;
};

export type ReadFailureReason =
  | "empty"
  | "too_large"
  | "too_many_rows"
  | "too_many_columns"
  | "unsupported_format"
  | "malformed";

// Précise un refus `unsupported_format` pour un message utile
// (« enregistrez le fichier en .xlsx ou .csv »).
export type UnsupportedHint = "xls" | "ods" | "xlsm" | "encrypted" | "binary";

export type ReadResult =
  | { ok: true; table: ImportTable }
  | { ok: false; reason: ReadFailureReason; hint?: UnsupportedHint };

// Limites de lecture. Taille et nombre de lignes viennent des réglages de la
// plateforme (jamais en dur dans l'appelant) ; les autres sont des garde-fous
// techniques contre les fichiers hostiles.
export type ReadLimits = {
  maxBytes: number;
  maxRows: number;
  maxColumns?: number;
  maxCellLength?: number;
  // Taille décompressée maximale cumulée d'un .xlsx (bombe zip).
  maxUncompressedBytes?: number;
  maxJsonDepth?: number;
};

export const DEFAULT_TECHNICAL_LIMITS = {
  maxColumns: 200,
  maxCellLength: 10_000,
  maxUncompressedBytes: 100 * 1024 * 1024,
  maxJsonDepth: 20,
} as const;

export class ReadError extends Error {
  constructor(
    readonly reason: ReadFailureReason,
    readonly hint?: UnsupportedHint,
  ) {
    super(reason);
  }
}
