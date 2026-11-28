// Lot 16 (IMP-11, ADR 0041) — assistant d'import : un seul service décide de
// l'étape suivante (`nextImportStep`) ; les écrans ne le recalculent plus.
// Étapes : Fichier, Colonnes, Types (prestataires seulement), Lignes (contacts
// seulement, lot 36b), Doublons, Vérifier et confirmer. Une étape sans rien à décider est faite d'office et
// franchie, avec son résumé ; un brouillon reprend là où il s'était arrêté.
import { appDatabase } from "@symbola/db/client";
import { getImportDraft, type ImportDraft, type ImportEntityType } from "@/modules/hub/service";
import { countImportRowFilterColumns, getImportMatchesView, type MatchesView } from "./matching";
import { getImportQuestions, hasQuestions, type ImportQuestionsView } from "./questions";
import { pendingBudgetDoublons } from "./budget-doublons";

// Lot 71c (HUB-14 ; maquette 07) : « Questions », entre les colonnes et les doublons, seulement s'il y a
// une réponse à donner.
export type ImportStepKey = "file" | "columns" | "types" | "rows" | "questions" | "matches" | "confirm";

// Étape « Doublons » : une proposition « sûre » est acceptée par « Tout accepter ».
export const SAFE_MATCH_SCORE = 90;

// Chemin de chaque étape sous /import/<id>.
export const IMPORT_STEP_PATHS: Record<ImportStepKey, string> = {
  file: "",
  columns: "/colonnes",
  types: "/types",
  rows: "/lignes",
  questions: "/questions",
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
  // Lot 71c : l'étape « Questions » (null : rien à demander, ou colonnes pas encore faites).
  questions: ImportQuestionsView | null;
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
  reviewed: { types?: boolean; matches?: boolean; rows?: boolean };
  // Lot 36b (D11) : colonnes proposées pour écarter des lignes d'un import de contacts.
  rowFilterColumns?: number;
  // Rapprochements calculés (après les colonnes) : choix de types et lignes.
  matches: Pick<MatchesView, "rows" | "vendorTypes"> | null;
  // Lot 71c : les questions posées et les réponses qui manquent (absent : aucune question).
  questions?: { asked: number; missing: number } | null;
  // Lot 71d (HUB-14, R17) : choix de « Doublons » d'un budget qui restent (poste sans ligne, doublon
  // possible du carnet) ; les postes répartis sont déjà des propositions en attente.
  doublonsPending?: number;
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

  if (input.entityType === "contacts") {
    const rowsDone = previousDone && input.matches !== null && (input.reviewed.rows === true || (input.rowFilterColumns ?? 0) === 0);
    const excluded = input.matches?.rows.filter((row) => row.errors.some((error) => error.code === "excluded_by_filter")).length ?? 0;
    steps.push({ key: "rows", done: rowsDone, summary: input.matches !== null ? { key: "rows", values: { excluded } } : null });
    previousDone = rowsDone;
  }

  if (input.questions && input.questions.asked > 0) {
    const questionsDone = previousDone && input.questions.missing === 0;
    steps.push({ key: "questions", done: questionsDone, summary: { key: "questions", values: { asked: input.questions.asked, missing: input.questions.missing } } });
    previousDone = questionsDone;
  }

  const rows = input.matches?.rows.filter((row) => row.errors.length === 0) ?? [];
  // À vérifier : une proposition en attente, ou une fiche du même lot qui décrit le même événement.
  // Lot 63b (HUB-14) : une proposition « À vérifier » pas encore vue compte aussi.
  const proposed = rows.filter((row) => row.match?.status === "proposed" || row.sameAsLine !== undefined || (row.match?.toVerify === true && row.match.reviewed !== true)).length;
  const updates = rows.filter((row) => row.match?.status === "accepted" || (input.entityType === "contacts" && row.sameAsLine !== undefined && !row.ignored)).length;
  const ignored = rows.filter((row) => row.ignored).length;
  // Lot 67a (HUB-14 ; recette du 24/11, R04) : une proposition sans décision bloque la confirmation.
  // « Continuer » ne la décide pas : l'étape n'est pas terminée, et la ligne n'est pas « nouvelle ».
  const undecidedMatches = undecidedMatchCount(input.matches?.rows ?? []);
  const doublonsPending = input.doublonsPending ?? 0;
  steps.push({
    key: "matches",
    done: previousDone && input.matches !== null && undecidedMatches === 0 && doublonsPending === 0 && (input.reviewed.matches === true || proposed === 0),
    summary:
      input.matches !== null
        ? input.entityType === "budget_lines"
          ? { key: "doublons", values: { pending: doublonsPending } }
          : { key: "matches", values: { updates, creations: rows.length - updates - ignored - undecidedMatches, proposed, undecided: undecidedMatches } }
        : null,
  });
  steps.push({ key: "confirm", done: false, summary: null });
  return steps;
}

// Lot 67a (HUB-14) — les rapprochements proposés que la planner n'a ni validés ni refusés : ceux qui
// empêchent de confirmer l'import (même règle que l'aperçu, `matches_undecided`).
export function undecidedMatchCount(rows: Pick<MatchesView["rows"][number], "errors" | "ignored" | "match">[]): number {
  return rows.filter((row) => row.errors.length === 0 && !row.ignored && row.match?.status === "proposed").length;
}

export async function getImportWizard(organizationId: string, importId: string, now: Date = new Date()): Promise<ImportWizard | null> {
  const db = appDatabase();
  const draft: ImportDraft | null = await getImportDraft(db, organizationId, importId);
  if (!draft) return null;
  const readJob = draft.jobs.find((job) => job.kind === "read_sheets");
  const readingDone = !readJob || readJob.status === "done";
  const undecided = draft.mapping?.some((choice) => choice.target === "none") ?? true;
  // Les rapprochements (et les types du fichier) se calculent une fois les colonnes faites.
  const matches = readingDone && !undecided ? await getImportMatchesView(organizationId, importId) : null;
  const questionsView = matches ? await getImportQuestions(organizationId, importId, { now }) : null;
  const questions = questionsView && hasQuestions(questionsView) ? questionsView : null;
  const steps = importWizardSteps({
    entityType: draft.entityType,
    rowCount: draft.rowCount,
    readingDone,
    mapping: draft.mapping,
    reviewed: draft.matching?.reviewed ?? {},
    matches,
    questions: questions ? { asked: Object.entries(questions.asked).filter(([key, value]) => value && key !== "prospectSource").length, missing: questions.missing.length } : null,
    ...(draft.entityType === "contacts" && matches ? { rowFilterColumns: await countImportRowFilterColumns(organizationId, importId) } : {}),
    ...(draft.entityType === "budget_lines" && matches ? { doublonsPending: (await pendingBudgetDoublons(organizationId, importId)).length } : {}),
  });
  return { importId: draft.id, fileName: draft.fileName, entityType: draft.entityType, steps, next: nextImportStep(steps), draft, matches, questions };
}
