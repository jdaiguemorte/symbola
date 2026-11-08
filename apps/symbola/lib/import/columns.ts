// Lot 16 (IMP-11, ADR 0041) — étape « Colonnes » de l'assistant : seules les
// colonnes qui demandent un choix sont présentées ; les autres se résument.
// Une colonne devient un champ, reste en champ libre sur la fiche, ou est
// ignorée, en une seule étape (l'ancien rapport des écarts pour les colonnes).
// Rien à décider : l'étape s'enregistre d'office à l'ouverture de l'import.
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import { decideFreeColumns, getImportColumns, saveImportMapping, type ImportColumnView, type SaveImportMappingResult } from "@/modules/hub/service";

// Choix d'une colonne : une clé de champ, « free » (champ libre) ou « ignore ».
export type ColumnDecision = { columnIndex: number; target: string; confirmed: boolean };

export const FREE = "free";
export const IGNORE = "ignore";

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await fn(db);
}

// Une colonne demande un choix si elle n'a ni proposition sûre ni décision du
// profil reconnu, ou si elle a été laissée « sans équivalent ».
export function columnNeedsChoice(column: ImportColumnView, lowConfidenceThreshold: number): boolean {
  if (column.saved) return column.saved.target === "none";
  if (column.proposedFieldKey) return column.confidence < lowConfidenceThreshold;
  return column.profileDecision === null;
}

// Valeur affichée dans la liste « devient » : le choix enregistré, sinon la
// proposition sûre ou la décision du profil, sinon rien : une proposition sous
// le seuil de confiance n'est jamais présélectionnée (IMP-02, à confirmer).
export function columnDecisionValue(column: ImportColumnView, lowConfidenceThreshold: number): string {
  const saved = column.saved;
  if (saved) {
    if (saved.target === "field") return saved.fieldKey ?? "";
    if (saved.target === "free") return FREE;
    if (saved.target === "ignore") return IGNORE;
    return "";
  }
  if (column.proposedFieldKey) return column.confidence >= lowConfidenceThreshold ? column.proposedFieldKey : "";
  if (column.profileDecision === "free") return FREE;
  if (column.profileDecision === "ignore") return IGNORE;
  return "";
}

export async function saveColumnDecisions(organizationId: string, importId: string, decisions: ColumnDecision[]): Promise<SaveImportMappingResult> {
  return withDb(async (db) => {
    const result = await saveImportMapping(db, {
      organizationId,
      importId,
      // Champ libre : « sans équivalent » pour la correspondance, puis gardé (IMP-04).
      choices: decisions.map((decision) => ({ ...decision, target: decision.target === FREE ? "none" : decision.target })),
    });
    if (result.status !== "saved") return result;
    const free = decisions.filter((decision) => decision.target === FREE).map((decision) => ({ columnIndex: decision.columnIndex, keep: true }));
    if (free.length > 0) await decideFreeColumns(db, { organizationId, importId, decisions: free });
    return result;
  });
}

// À l'ouverture d'un import : si aucune colonne ne demande de choix, les
// propositions (et les décisions du profil) sont enregistrées d'office.
export async function saveColumnsIfNothingToDecide(organizationId: string, importId: string): Promise<boolean> {
  const view = await withDb((db) => getImportColumns(db, organizationId, importId));
  if (!view || view.columns.some((column) => column.saved !== null)) return false;
  if (view.columns.some((column) => columnNeedsChoice(column, view.lowConfidenceThreshold))) return false;
  const decisions = view.columns.map((column) => ({ columnIndex: column.columnIndex, target: columnDecisionValue(column, view.lowConfidenceThreshold), confirmed: false }));
  return (await saveColumnDecisions(organizationId, importId, decisions)).status === "saved";
}
