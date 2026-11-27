// Lot 71f (EVT-02, HUB-08, UX-01, UX-06, BUD-01 ; spécification du lot 71, § 5.6 ; maquette 09 ; R7 à
// R9, I2, I7 ; constats C-53, C-55, C-56, C-61, C-64) — ce qui reste à compléter après la reprise d'un
// mariage, en règles pures. Rien n'est compté comme complet qui ne l'est pas : chaque point se calcule à
// chaque lecture, sur ce qui est réellement renseigné, et n'est jamais stocké (seule la date de la
// première liste vide l'est, `hub.takeovers.completed_at`). Les dates sont des jours de Paris (AAAA-MM-JJ),
// pour que l'horloge simulée des tests fixe la fenêtre de sept jours (R9).
import { isStepSettled, TAKEOVER_STEP_KINDS, type TakeoverStepKind, type TakeoverStepState } from "@symbola/contracts";

// Les six points, dans l'ordre de la maquette 09.
export const CHECKLIST_KEYS = ["amounts", "contracts", "tasks", "endTimes", "clientLink", "guests"] as const;
export type ChecklistKey = (typeof CHECKLIST_KEYS)[number];

export type ChecklistFacts = {
  // Reste à répartir du total d'un fichier (null : le fichier ne donnait aucun total).
  remainingCents: number | null;
  // Postes retenus dont le prévu n'est pas connu (« Montants de 12 prestataires »).
  slotsWithoutAmount: number;
  // Prestataires repris dont le contrat est dit non signé ou non renseigné, encore non signés (I2).
  unsignedContracts: string[];
  taskCount: number;
  // Moments du programme à début et fin (« span ») sans heure de fin ; ni un ponctuel, ni un repère.
  missingEndTimes: number;
  hasClientLink: boolean;
  guestsKnown: boolean;
};

export type ChecklistPoint = {
  key: ChecklistKey;
  done: boolean;
  // Le nombre de la ligne (« 12 prestataires », « 7 heures de fin », « 2 contrats ») ; 0 une fois fait.
  count: number;
  // Les noms des prestataires dont le contrat n'est pas signé (« Les P'tits Loups, Belles Carrosseries »).
  names: string[];
  // Le reste à répartir, quand le fichier donnait un total.
  remainingCents: number | null;
};

// Un point par sorte ; ceux qui restent d'abord, dans l'ordre ; un point fait passe en bas, coché.
export function checklistPoints(facts: ChecklistFacts): ChecklistPoint[] {
  const remaining = facts.remainingCents !== null && facts.remainingCents > 0 ? facts.remainingCents : null;
  const amountsCount = facts.slotsWithoutAmount;
  const points: ChecklistPoint[] = [
    { key: "amounts", done: amountsCount === 0 && remaining === null, count: amountsCount, names: [], remainingCents: remaining },
    { key: "contracts", done: facts.unsignedContracts.length === 0, count: facts.unsignedContracts.length, names: facts.unsignedContracts, remainingCents: null },
    { key: "tasks", done: facts.taskCount > 0, count: facts.taskCount > 0 ? 0 : 1, names: [], remainingCents: null },
    { key: "endTimes", done: facts.missingEndTimes === 0, count: facts.missingEndTimes, names: [], remainingCents: null },
    { key: "clientLink", done: facts.hasClientLink, count: facts.hasClientLink ? 0 : 1, names: [], remainingCents: null },
    { key: "guests", done: facts.guestsKnown, count: facts.guestsKnown ? 0 : 1, names: [], remainingCents: null },
  ];
  return [...points.filter((point) => !point.done), ...points.filter((point) => point.done)];
}

export function pendingPoints(points: readonly ChecklistPoint[]): ChecklistPoint[] {
  return points.filter((point) => !point.done);
}

// R9 : le bloc « Reprise complétée le … » reste sept jours, puis « Prochaine action » revient.
export const CHECKLIST_COMPLETED_DAYS = 7;

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T12:00:00Z`) / 86_400_000);
}

export type ChecklistBlock =
  // « À compléter après la reprise » : les points, à la place de « Prochaine action ».
  | { kind: "open"; points: ChecklistPoint[]; done: number; total: number }
  // « ✓ Reprise complétée le 2 déc. · Revoir la liste » (le jour de Paris où la liste s'est vidée).
  | { kind: "completed"; completedOn: string; points: ChecklistPoint[] }
  // Rien : la fiche redevient une fiche comme les autres.
  | { kind: "hidden" };

// Le bloc de la Synthèse. `completedOn` : le jour où la liste s'est vidée pour la première fois (null :
// jamais encore) ; `today` : le jour de Paris. Une liste vide jamais encore datée l'est aujourd'hui (la
// lecture pose `completed_at`). Passé sept jours, le bloc ne revient plus, même si un point se défait.
export function checklistBlock(points: readonly ChecklistPoint[], completedOn: string | null, today: string): ChecklistBlock {
  if (completedOn !== null && dayNumber(today) - dayNumber(completedOn) > CHECKLIST_COMPLETED_DAYS) return { kind: "hidden" };
  const pending = pendingPoints(points).length;
  if (pending > 0) return { kind: "open", points: [...points], done: points.length - pending, total: points.length };
  return { kind: "completed", completedOn: completedOn ?? today, points: [...points] };
}

// —— La reprise vue de la liste des évènements et d'« Aujourd'hui » ————————————————————————————

export type TakeoverStepFacts = { kind: TakeoverStepKind; state: TakeoverStepState; importId: string | null; decidedAt: Date | null };

// « de 4 fichiers » : les lignes faites par un fichier (le mariage saisi à la main n'en est pas un).
export function takeoverFileCount(steps: readonly TakeoverStepFacts[]): number {
  return steps.filter((step) => step.state === "done" && !(step.kind === "event" && step.importId === null)).length;
}

// La marque de la liste et la ligne d'« Aujourd'hui » : les fichiers tant qu'une ligne reste, puis les
// points à compléter ; rien une fois la reprise complétée (la marque quitte la ligne, P-06).
export type TakeoverMark = { kind: "files"; settled: number; total: number } | { kind: "points"; count: number } | null;

export function takeoverMark(input: { steps: readonly Pick<TakeoverStepFacts, "state">[]; completedAt: Date | null; pendingPoints: number }): TakeoverMark {
  if (input.completedAt !== null) return null;
  const settled = input.steps.filter((step) => isStepSettled(step.state)).length;
  if (settled < TAKEOVER_STEP_KINDS.length) return { kind: "files", settled, total: TAKEOVER_STEP_KINDS.length };
  if (input.pendingPoints > 0) return { kind: "points", count: input.pendingPoints };
  return null;
}

// L'import en cours d'une reprise (« import du budget en cours »), la première ligne dans l'ordre.
export function runningStep(steps: readonly Pick<TakeoverStepFacts, "kind" | "state">[]): TakeoverStepKind | null {
  return TAKEOVER_STEP_KINDS.find((kind) => steps.some((step) => step.kind === kind && step.state === "in_progress")) ?? null;
}

// Le moment où la dernière ligne a été réglée (« reprise terminée hier ») ; null tant qu'une ligne reste.
export function takeoverFinishedAt(steps: readonly Pick<TakeoverStepFacts, "state" | "decidedAt">[]): Date | null {
  if (steps.length < TAKEOVER_STEP_KINDS.length || !steps.every((step) => isStepSettled(step.state))) return null;
  const dates = steps.map((step) => step.decidedAt).filter((date): date is Date => date !== null);
  return dates.length === 0 ? null : new Date(Math.max(...dates.map((date) => date.getTime())));
}

// —— Les postes du budget (décision I7) —————————————————————————————————————————————————————

const ENGAGED = new Set(["retained", "contract_signed", "paid_off"]);

// « 6 postes complets sur 9 », pour tous les mariages : un poste est complet quand un prestataire y est
// retenu et que son prévu est connu ; un poste « non requis » ne compte pas.
export function completeSlots(slots: readonly { status: string; plannedCents: number | null }[]): { complete: number; total: number } {
  const required = slots.filter((slot) => slot.status !== "not_required");
  return { complete: required.filter((slot) => ENGAGED.has(slot.status) && slot.plannedCents !== null).length, total: required.length };
}

// « Montants de 12 prestataires » : les postes retenus dont le prévu manque.
export function slotsWithoutAmount(slots: readonly { status: string; plannedCents: number | null }[]): number {
  return slots.filter((slot) => ENGAGED.has(slot.status) && slot.plannedCents === null).length;
}
