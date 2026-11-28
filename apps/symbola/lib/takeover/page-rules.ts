// Lot 71b (HUB-14, PAR-01, UX-02, UX-08 ; spécification du lot 71, § 5.2 ; maquette 06 ; R1 à R4) — la
// page « Reprendre un mariage en cours » en règles pures : six lignes dans l'ordre où déposer les
// fichiers, l'état de chacune en mots et par une forme (jamais par la seule couleur), la ligne suivante
// qui porte la seule action principale, les lignes qui attendent le mariage (« Après le mariage », sans
// bouton grisé), et la fin : la date limite de retrait, ce qui reste à compléter à la main.
import {
  isStepSettled,
  nextTakeoverStep,
  TAKEOVER_STEP_KINDS,
  type TakeoverStepKind,
  type TakeoverStepState,
} from "@symbola/contracts";

export type TakeoverRowStep = { kind: TakeoverStepKind; state: TakeoverStepState; importId: string | null; decidedAt: Date | null };

// Rond plein et coche (fait), rond tracé (en cours), pointillés (à faire), tiret (pas de fichier, ou
// avec le budget).
export type TakeoverRowShape = "done" | "running" | "todo" | "none";

export type TakeoverRowAction =
  // À faire : déposer le fichier (la fiche, pour le mariage), saisir le mariage, « Je n'ai pas ce fichier ».
  | "drop"
  | "dropSheet"
  | "enterNames"
  | "noFile"
  // En cours : « Continuer », « Abandonner cet import… ».
  | "continue"
  | "abandon"
  // Faite : « Voir le bilan » (un import), « Ouvrir la fiche » (le mariage saisi).
  | "seeSummary"
  | "openEvent"
  // Pas de fichier : « Déposer un fichier » ; avec le budget : « Déposer un fichier quand même ».
  | "dropAgain"
  | "dropAnyway";

export type TakeoverRow = TakeoverRowStep & {
  number: number;
  shape: TakeoverRowShape;
  // La ligne suivante : trait d'encre, et la seule action principale de la page.
  next: boolean;
  // Lignes 3 à 6 tant que le mariage n'existe pas : elles disent pourquoi elles attendent.
  waiting: boolean;
  actions: TakeoverRowAction[];
  primary: TakeoverRowAction | null;
};

const NEEDS_EVENT: readonly TakeoverStepKind[] = ["budget", "event_vendors", "tasks", "program"];

const SHAPES: Record<TakeoverStepState, TakeoverRowShape> = { done: "done", in_progress: "running", todo: "todo", no_file: "none", covered: "none" };

function actionsOf(step: TakeoverRowStep, waiting: boolean): TakeoverRowAction[] {
  if (waiting) return [];
  switch (step.state) {
    case "todo":
      // Le mariage ne se passe pas : sans lui, rien ne s'y rattache. Il vient d'une fiche, ou se saisit.
      return step.kind === "event" ? ["dropSheet", "enterNames"] : ["drop", "noFile"];
    case "in_progress":
      return step.importId ? ["continue", "abandon"] : [];
    case "done":
      if (step.importId) return ["seeSummary"];
      return step.kind === "event" ? ["openEvent"] : [];
    case "no_file":
      return ["dropAgain"];
    case "covered":
      return ["dropAnyway"];
  }
}

export function takeoverRows(steps: readonly TakeoverRowStep[], context: { eventExists: boolean }): TakeoverRow[] {
  const byKind = new Map(steps.map((step) => [step.kind, step] as const));
  const ordered = TAKEOVER_STEP_KINDS.map((kind) => byKind.get(kind) ?? { kind, state: "todo" as const, importId: null, decidedAt: null });
  const next = nextTakeoverStep(ordered);
  return ordered.map((step, index) => {
    const waiting = !context.eventExists && NEEDS_EVENT.includes(step.kind) && step.state === "todo";
    const actions = actionsOf(step, waiting);
    const isNext = next !== null && next.kind === step.kind && actions.length > 0;
    return { ...step, number: index + 1, shape: SHAPES[step.state], next: isNext, waiting, actions, primary: isNext ? actions[0]! : null };
  });
}

// Terminée quand les six lignes sont réglées (R4) ; elle passe alors la main à la fiche.
export function takeoverPageState(steps: readonly Pick<TakeoverRowStep, "state">[]): "open" | "done" {
  return steps.length === TAKEOVER_STEP_KINDS.length && steps.every((step) => isStepSettled(step.state)) ? "done" : "open";
}

// La sorte d'import qu'ouvre chaque ligne. Lot 71e : les PDF des prestataires retenus et du programme
// passent eux aussi par l'assistant commun.
const IMPORT_ENTITY: Record<TakeoverStepKind, string | null> = {
  vendor_book: "vendors",
  event: "event_sheets",
  budget: "budget_lines",
  event_vendors: "event_vendors",
  tasks: "tasks",
  program: "program",
};

export function takeoverImportEntityType(kind: TakeoverStepKind): string | null {
  return IMPORT_ENTITY[kind];
}

// La ligne qu'un import remplit, d'après sa sorte (la route d'envoi, la confirmation).
export function takeoverKindOfEntity(entityType: string): TakeoverStepKind | null {
  return TAKEOVER_STEP_KINDS.find((kind) => IMPORT_ENTITY[kind] === entityType) ?? null;
}

// Le nom de ce qu'un import a écrit, pour le nombre d'une ligne faite (« 7 fiches », « 14 lignes »).
const FIGURE_KEYS: Record<string, string> = { vendors: "vendors", budget_lines: "budgetLines", tasks: "tasks", event_sheets: "events", events: "events", event_vendors: "retainedVendors", program: "moments" };

export function importFigureKey(entityType: string): string {
  return FIGURE_KEYS[entityType] ?? "rows";
}

// Lot 71d (HUB-14, C-58 ; critère 5) : le nombre d'une ligne faite est celui du bilan, compté par
// importFigures et gardé au journal (« 14 lignes » d'un budget). Un import d'avant le lot garde son
// ancien compte (créés et mis à jour).
export function importFigureCount(result: { created: number; updated: number; figures?: Record<string, unknown> }): number {
  const figures = result.figures;
  if (figures?.kind === "budget" && typeof figures.lines === "number") return figures.lines;
  if (figures?.kind === "rows" && typeof figures.rows === "number") return figures.rows;
  // Lot 71e : les prestataires retenus, les moments du programme (les nombres du bilan).
  if (figures?.kind === "event_vendors" && typeof figures.vendors === "number") return figures.vendors;
  if (figures?.kind === "program" && typeof figures.moments === "number") return figures.moments;
  return result.created + result.updated;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// « Chaque import se retire depuis son bilan jusqu'au … » : la date du premier qui ne se retirera plus.
export function withdrawDeadline(appliedAts: readonly Date[], undoRetentionDays: number): Date | null {
  if (appliedAts.length === 0) return null;
  const first = Math.min(...appliedAts.map((date) => date.getTime()));
  return new Date(first + undoRetentionDays * DAY_MS);
}
