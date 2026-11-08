// Lot 16 (IMP-11, ADR 0041) — assistant d'import : un seul service décide de
// l'étape suivante (`nextImportStep`) ; les écrans ne le recalculent plus.
// Étapes : Fichier, Colonnes, Types (prestataires seulement), Doublons,
// Vérifier et confirmer. Une étape sans rien à décider est faite d'office et
// franchie, avec son résumé ; un brouillon reprend là où il s'était arrêté.
import { appDatabase } from "@symbola/db/client";
import { getImportDraft, type ImportDraft, type ImportEntityType } from "@/modules/hub/service";
import { getImportMatchesView, type MatchesView } from "./matching";

export type ImportStepKey = "file" | "columns" | "types" | "matches" | "confirm";

// Étape « Doublons » : une proposition « sûre » est acceptée par « Tout accepter ».
export const SAFE_MATCH_SCORE = 90;

// Chemin de chaque étape sous /import/<id>.
export const IMPORT_STEP_PATHS: Record<ImportStepKey, string> = {
  file: "",
  columns: "/colonnes",
  types: "/types",
  matches: "/rapprochements",
  confirm: "/confirmation",
};

// Résumé d'une étape faite : clé de traduction (Import.summary.*) et valeurs.
export type ImportStepSummary = { key: string; values: Record<string, number> };

export type ImportWizardStep = { key: ImportStepKey; done: boolean; summary: ImportStepSummary | null };

export type ImportWizard = {
  importId: string;
  fileName: string;
  entityType: ImportEntityType;
  steps: ImportWizardStep[];
  next: ImportStepKey;
  draft: ImportDraft;
  matches: MatchesView | null;
};

export function importStepHref(importId: string, step: ImportStepKey): string {
  return `/import/${importId}${IMPORT_STEP_PATHS[step]}`;
}

// Première étape pas encore faite ; « confirm » quand tout le reste l'est.
export function nextImportStep(steps: Pick<ImportWizardStep, "key" | "done">[]): ImportStepKey {
  return steps.find((step) => !step.done && step.key !== "confirm")?.key ?? "confirm";
}

type StepInput = {
  entityType: ImportEntityType;
  rowCount: number;
  readingDone: boolean;
  mapping: ImportDraft["mapping"];
  reviewed: { types?: boolean; matches?: boolean };
  // Rapprochements calculés (après les colonnes) : choix de types et lignes.
  matches: Pick<MatchesView, "rows" | "vendorTypes"> | null;
};

// Calcul pur des étapes (testé sans base).
export function importWizardSteps(input: StepInput): ImportWizardStep[] {
  const steps: ImportWizardStep[] = [{ key: "file", done: input.readingDone, summary: { key: "file", values: { rows: input.rowCount } } }];

  const mapping = input.mapping;
  const undecided = mapping ? mapping.filter((choice) => choice.target === "none").length : null;
  const columnsDone = input.readingDone && mapping !== null && undecided === 0;
  steps.push({
    key: "columns",
    done: columnsDone,
    summary: mapping
      ? {
          key: "columns",
          values: {
            recognized: mapping.filter((choice) => choice.target === "field").length,
            kept: mapping.filter((choice) => choice.target === "free").length,
            ignored: mapping.filter((choice) => choice.target === "ignore").length,
          },
        }
      : null,
  });

  let previousDone = columnsDone;
  if (input.entityType === "vendors") {
    const choices = input.matches?.vendorTypes ?? [];
    const toReview = choices.filter((choice) => choice.target.kind !== "existing").length;
    const typesDone = previousDone && input.matches !== null && (input.reviewed.types === true || toReview === 0);
    const starters = new Set(choices.flatMap((choice) => (choice.target.kind === "starter" ? [choice.target.starterKey] : [])));
    steps.push({
      key: "types",
      done: typesDone,
      summary:
        input.matches !== null
          ? {
              key: "types",
              values: {
                labels: choices.length,
                created: starters.size + choices.filter((choice) => choice.target.kind === "new").length,
                unclassified: choices.filter((choice) => choice.target.kind === "none").length,
              },
            }
          : null,
    });
    previousDone = typesDone;
  }

  const rows = input.matches?.rows.filter((row) => row.errors.length === 0) ?? [];
  // À vérifier : une proposition en attente, ou une fiche du même lot qui décrit le même événement.
  const proposed = rows.filter((row) => row.match?.status === "proposed" || row.sameAsLine !== undefined).length;
  const updates = rows.filter((row) => row.match?.status === "accepted").length;
  steps.push({
    key: "matches",
    done: previousDone && input.matches !== null && (input.reviewed.matches === true || proposed === 0),
    summary: input.matches !== null ? { key: "matches", values: { updates, creations: rows.length - updates, proposed } } : null,
  });
  steps.push({ key: "confirm", done: false, summary: null });
  return steps;
}

export async function getImportWizard(organizationId: string, importId: string): Promise<ImportWizard | null> {
  const db = appDatabase();
  const draft: ImportDraft | null = await getImportDraft(db, organizationId, importId);
  if (!draft) return null;
  const readJob = draft.jobs.find((job) => job.kind === "read_sheets");
  const readingDone = !readJob || readJob.status === "done";
  const undecided = draft.mapping?.some((choice) => choice.target === "none") ?? true;
  // Les rapprochements (et les types du fichier) se calculent une fois les colonnes faites.
  const matches = readingDone && !undecided ? await getImportMatchesView(organizationId, importId) : null;
  const steps = importWizardSteps({
    entityType: draft.entityType,
    rowCount: draft.rowCount,
    readingDone,
    mapping: draft.mapping,
    reviewed: draft.matching?.reviewed ?? {},
    matches,
  });
  return { importId: draft.id, fileName: draft.fileName, entityType: draft.entityType, steps, next: nextImportStep(steps), draft, matches };
}
