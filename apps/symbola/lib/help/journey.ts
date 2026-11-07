// Lot 13 (AIDE-10) — parcours des tutoriels (décision B de Julien) : d'abord
// ce qui remplit les listes utilisées plus tard, puis le premier événement et
// ce qui en découle. Ordre conseillé, jamais bloquant (décision A). Un seul
// tutoriel en cours à la fois.
import type { HelpProgressEntry } from "@/modules/hub/service";
import type { TutorialDefinition, TutorialKey } from "./catalog";

export type JourneyStageKey = "activity" | "templates" | "first_event" | "sales" | "clients" | "other";

export const JOURNEY: { key: JourneyStageKey; tutorials: TutorialKey[] }[] = [
  { key: "activity", tutorials: ["catalog"] },
  { key: "templates", tutorials: ["retroplanning-template", "day-program", "budget-simulation"] },
  { key: "first_event", tutorials: ["event-page", "vendor-quotes"] },
  { key: "sales", tutorials: ["quote-signature", "deposit-invoice"] },
  { key: "clients", tutorials: ["client-space"] },
  // L'import n'est pas dans le parcours (lot 14) : proposé à part.
  { key: "other", tutorials: ["import"] },
];

export type TutorialState = "done" | "current" | "next" | "todo";

const keyOf = (key: TutorialKey) => `tutorial:${key}`;

// En cours : commencé (une étape franchie ou un exemple créé), pas terminé.
// Une invitation mise de côté à l'étape 0 ne compte pas.
export function isInProgress(entry: HelpProgressEntry | undefined): boolean {
  return Boolean(entry) && entry!.status !== "completed" && (entry!.step > 0 || entry!.context !== null);
}

export function tutorialInProgress(available: TutorialDefinition[], progress: HelpProgressEntry[]): TutorialKey | null {
  const started = available
    .map((tutorial) => ({ key: tutorial.key, entry: progress.find((entry) => entry.itemKey === keyOf(tutorial.key)) }))
    .filter(({ entry }) => isInProgress(entry))
    .sort((a, b) => b.entry!.updatedAt.getTime() - a.entry!.updatedAt.getTime());
  return started[0]?.key ?? null;
}

export function journeyStates(available: TutorialDefinition[], progress: HelpProgressEntry[]): Map<TutorialKey, TutorialState> {
  const states = new Map<TutorialKey, TutorialState>();
  const current = tutorialInProgress(available, progress);
  const offered = new Set(available.map((tutorial) => tutorial.key));
  let nextGiven = false;
  for (const stage of JOURNEY) {
    for (const key of stage.tutorials) {
      if (!offered.has(key)) continue;
      const entry = progress.find((candidate) => candidate.itemKey === keyOf(key));
      if (entry?.status === "completed") states.set(key, "done");
      else if (key === current) states.set(key, "current");
      else if (!current && !nextGiven && stage.key !== "other") {
        states.set(key, "next");
        nextGiven = true;
      } else states.set(key, "todo");
    }
  }
  return states;
}
