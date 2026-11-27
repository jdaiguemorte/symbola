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

// La sorte d'import qu'ouvre chaque ligne. Les PDF des prestataires retenus et du programme passent
// encore par leur envoi sur la fiche du mariage, jusqu'au paquet 71e : null.
const IMPORT_ENTITY: Record<TakeoverStepKind, string | null> = {
  vendor_book: "vendors",
  event: "event_sheets",
  budget: "budget_lines",
  event_vendors: null,
  tasks: "tasks",
  program: null,
};

export function takeoverImportEntityType(kind: TakeoverStepKind): string | null {
  return IMPORT_ENTITY[kind];
}

// La ligne qu'un import remplit, d'après sa sorte (la route d'envoi, la confirmation).
export function takeoverKindOfEntity(entityType: string): TakeoverStepKind | null {
  return TAKEOVER_STEP_KINDS.find((kind) => IMPORT_ENTITY[kind] === entityType) ?? null;
}

// Le nom de ce qu'un import a écrit, pour le nombre d'une ligne faite (« 7 fiches », « 14 lignes »).
// Provisoire jusqu'au paquet 71d, qui donne une seule fonction de compte pour « Vérifier », le bilan et
// cette page.
const FIGURE_KEYS: Record<string, string> = { vendors: "vendors", budget_lines: "budgetLines", tasks: "tasks", event_sheets: "events", events: "events" };

export function importFigureKey(entityType: string): string {
  return FIGURE_KEYS[entityType] ?? "rows";
}

const DAY_MS = 24 * 60 * 60 * 1000;

// « Chaque import se retire depuis son bilan jusqu'au … » : la date du premier qui ne se retirera plus.
export function withdrawDeadline(appliedAts: readonly Date[], undoRetentionDays: number): Date | null {
  if (appliedAts.length === 0) return null;
  const first = Math.min(...appliedAts.map((date) => date.getTime()));
  return new Date(first + undoRetentionDays * DAY_MS);
}

// Ce qui reste à compléter à la main après la reprise (C-55) : les points que la page sait compter
// aujourd'hui. Le paquet 71f les calcule dans le hub, pour la fiche, avec les contrats non signés.
export type ToCompleteFacts = {
  // Reste à répartir du total d'un fichier (null : aucun total).
  remainingCents: number | null;
  taskCount: number;
  // Moments du programme sans heure de fin.
  missingEndTimes: number;
  hasClientLink: boolean;
  guestsKnown: boolean;
};

export type ToCompletePoint = { key: "amounts" | "tasks" | "endTimes" | "clientLink" | "guests"; count: number };

export function toCompletePoints(facts: ToCompleteFacts): ToCompletePoint[] {
  const points: ToCompletePoint[] = [];
  if (facts.remainingCents !== null && facts.remainingCents > 0) points.push({ key: "amounts", count: 1 });
  if (facts.taskCount === 0) points.push({ key: "tasks", count: 1 });
  if (facts.missingEndTimes > 0) points.push({ key: "endTimes", count: facts.missingEndTimes });
  if (!facts.hasClientLink) points.push({ key: "clientLink", count: 1 });
  if (!facts.guestsKnown) points.push({ key: "guests", count: 1 });
  return points;
}
