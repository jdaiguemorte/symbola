// Lot 71a (HUB-14, PAR-01 ; spécification du lot 71, § 4.1 et § 4.4 ; ADR 0119) — la reprise d'un
// mariage en cours : ses six lignes, dans l'ordre où déposer les fichiers (R2), leurs états, et le
// compteur « 3 fichiers sur 6 » (R4). Règles pures, partagées par le hub et les écrans.

export const TAKEOVER_STEP_KINDS = ["vendor_book", "event", "budget", "event_vendors", "tasks", "program"] as const;
export type TakeoverStepKind = (typeof TAKEOVER_STEP_KINDS)[number];

export const TAKEOVER_STEP_STATES = ["todo", "in_progress", "done", "no_file", "covered"] as const;
export type TakeoverStepState = (typeof TAKEOVER_STEP_STATES)[number];

export type TakeoverStepView = {
  id: string;
  kind: TakeoverStepKind;
  state: TakeoverStepState;
  importId: string | null;
  coveredByStepId: string | null;
  decidedAt: Date | null;
};

export type TakeoverView = {
  id: string;
  eventId: string | null;
  createdAt: Date;
  completedAt: Date | null;
  checklistClosedAt: Date | null;
  steps: TakeoverStepView[];
  progress: { settled: number; total: number };
};

// R4 : une ligne compte quand elle est faite, réglée sans fichier, ou couverte par une autre (même si
// l'import qui la couvre est encore en cours : la planner n'a plus rien à y déposer).
export function isStepSettled(state: TakeoverStepState): boolean {
  return state === "done" || state === "no_file" || state === "covered";
}

export function takeoverProgress(steps: readonly Pick<TakeoverStepView, "state">[]): { settled: number; total: number } {
  return { settled: steps.filter((step) => isStepSettled(step.state)).length, total: TAKEOVER_STEP_KINDS.length };
}

// La ligne suivante (le seul bouton principal de la page) : la première, dans l'ordre, qui n'est pas réglée.
export function nextTakeoverStep<T extends Pick<TakeoverStepView, "kind" | "state">>(steps: readonly T[]): T | null {
  const byKind = new Map(steps.map((step) => [step.kind, step] as const));
  for (const kind of TAKEOVER_STEP_KINDS) {
    const step = byKind.get(kind);
    if (step && !isStepSettled(step.state)) return step;
  }
  return null;
}

// Sorte d'import qui remplit chaque ligne (la fiche PDF du mariage, ou rien quand il est saisi à la main).
export const TAKEOVER_STEP_IMPORT_KINDS: Record<TakeoverStepKind, readonly string[]> = {
  vendor_book: ["vendors"],
  event: ["event_sheets", "events"],
  budget: ["budget_lines"],
  event_vendors: ["event_vendors"],
  tasks: ["tasks"],
  program: ["program"],
};
