// Lot 13 (AIDE-10) — parcours des tutoriels : ordre conseillé, jamais bloquant (décision A) ; un seul
// tutoriel en cours à la fois.
// Lot 74f (HUB-11 ; spécification du lot 74, § 6.6 ; maquette 28 ; D6, C-10, C-70) : deux parcours, choisis
// par la réponse de l'assistant « Avez-vous déjà des mariages en cours ? » (`has_ongoing_events`, 74a) et
// changeables par la personne. Chaque étape regroupe des tutoriels et, s'il y en a, le geste qui la dit faite
// dans l'espace (le premier mariage créé, la reprise ouverte, le premier prestataire), tutoriel suivi ou non.
// « Pour bien démarrer » (accueil, Aide) et la page Tutoriels lisent ce même parcours : une seule liste.
import type { HelpProgressEntry } from "@/modules/hub/service";
import type { TutorialDefinition, TutorialKey } from "./catalog";

export type JourneyPath = "takeover" | "scratch";
export const JOURNEY_PATHS: readonly JourneyPath[] = ["takeover", "scratch"];

// Les gestes faits dans l'espace : « Régler l'essentiel » et « Ajouter un premier prestataire », les deux
// éléments de l'ancienne liste de l'accueil, sont devenus des marches de leur étape.
export type JourneyGesture = "takeover" | "takeover_complete" | "first_event" | "first_vendor" | "essentials";

export type JourneyStageKey = "takeover" | "complete" | "first_event" | "templates" | "vendors" | "sales";

export type JourneyStage = { key: JourneyStageKey; tutorials: TutorialKey[]; gestures: JourneyGesture[] };
export type JourneyDefinition = { stages: JourneyStage[]; others: TutorialKey[] };

const SALES: JourneyStage = { key: "sales", tutorials: ["documents", "catalog", "quote-signature", "deposit-invoice"], gestures: ["essentials"] };
const VENDORS: JourneyStage = { key: "vendors", tutorials: ["vendor-quotes"], gestures: ["first_vendor"] };
const TEMPLATES: JourneyStage = { key: "templates", tutorials: ["retroplanning-template", "day-program"], gestures: [] };

// Maquette 28 : les devis ne sont en tête d'aucun parcours ; tous les tutoriels sont rangés, les autres
// sous « Autres tutoriels ».
export const JOURNEYS: Record<JourneyPath, JourneyDefinition> = {
  takeover: {
    stages: [
      { key: "takeover", tutorials: ["import"], gestures: ["takeover"] },
      { key: "complete", tutorials: ["complete-takeover"], gestures: ["takeover_complete"] },
      VENDORS,
      TEMPLATES,
      SALES,
    ],
    others: ["budget-simulation", "client-space", "event-page"],
  },
  scratch: {
    stages: [{ key: "first_event", tutorials: ["event-page"], gestures: ["first_event"] }, TEMPLATES, VENDORS, SALES],
    others: ["budget-simulation", "client-space", "import", "complete-takeover"],
  },
};

export type JourneyChoice = { path: JourneyPath; by: "answer" | "choice" | "default" };

// Le choix gardé de la personne (« Changer de parcours »), puis la réponse de l'assistant ; sans l'un ni
// l'autre, « Je pars de zéro ».
export const JOURNEY_ITEM_KEY = "setup:journey";

export function isJourneyPath(value: unknown): value is JourneyPath {
  return value === "takeover" || value === "scratch";
}

export function chooseJourney(hasOngoingEvents: string | null, progress: readonly HelpProgressEntry[]): JourneyChoice {
  const chosen = progress.find((entry) => entry.itemKey === JOURNEY_ITEM_KEY)?.context?.path;
  if (isJourneyPath(chosen)) return { path: chosen, by: "choice" };
  if (hasOngoingEvents === "yes") return { path: "takeover", by: "answer" };
  if (hasOngoingEvents === "no") return { path: "scratch", by: "answer" };
  return { path: "scratch", by: "default" };
}

export type TutorialState = "done" | "current" | "next" | "todo";
export type StageState = "done" | "current" | "next" | "todo";

const keyOf = (key: TutorialKey) => `tutorial:${key}`;

// En cours : commencé (une étape franchie ou un exemple créé), pas terminé.
// Une invitation mise de côté à l'étape 0 ne compte pas.
export function isInProgress(entry: HelpProgressEntry | undefined): boolean {
  return Boolean(entry) && entry!.status !== "completed" && (entry!.step > 0 || entry!.context !== null);
}

export function tutorialInProgress(available: TutorialDefinition[], progress: readonly HelpProgressEntry[]): TutorialKey | null {
  const started = available
    .map((tutorial) => ({ key: tutorial.key, entry: progress.find((entry) => entry.itemKey === keyOf(tutorial.key)) }))
    .filter(({ entry }) => isInProgress(entry))
    .sort((a, b) => b.entry!.updatedAt.getTime() - a.entry!.updatedAt.getTime());
  return started[0]?.key ?? null;
}

function isCompleted(progress: readonly HelpProgressEntry[], key: TutorialKey): boolean {
  return progress.some((entry) => entry.itemKey === keyOf(key) && entry.status === "completed");
}

export type JourneyGestures = Partial<Record<JourneyGesture, boolean>>;

export type JourneyStageView = {
  key: JourneyStageKey;
  number: number;
  state: StageState;
  tutorials: { key: TutorialKey; minutes: number; state: TutorialState }[];
  // Les marches de l'étape faites dans l'espace, avec leur état ; une marche d'un module non souscrit
  // n'existe pas (ARC-06).
  gestures: { key: JourneyGesture; done: boolean }[];
  minutes: number;
  // Quand l'étape est faite : le dernier tutoriel terminé, s'il y en a un (« Fait le 24 nov. »).
  doneAt: Date | null;
};

export type JourneyView = {
  choice: JourneyChoice;
  stages: JourneyStageView[];
  others: { key: TutorialKey; minutes: number; state: TutorialState }[];
  done: number;
  total: number;
  // Minutes des tutoriels pas encore faits, dans les étapes pas encore faites.
  remainingMinutes: number;
  current: TutorialKey | null;
  next: JourneyStageView | null;
};

// Le parcours de la personne : ses étapes (sans celles dont aucun tutoriel ni geste n'est offert), leur
// état, les autres tutoriels. `gestures` : ce que l'espace dit déjà fait ; `available` : les tutoriels des
// modules souscrits.
export function buildJourney(input: {
  choice: JourneyChoice;
  available: readonly TutorialDefinition[];
  progress: readonly HelpProgressEntry[];
  gestures: JourneyGestures;
}): JourneyView {
  const definition = JOURNEYS[input.choice.path];
  const minutesOf = new Map(input.available.map((tutorial) => [tutorial.key, tutorial.minutes]));
  const offered = (key: TutorialKey) => minutesOf.has(key);
  const current = tutorialInProgress([...input.available], input.progress);
  const tutorialState = (key: TutorialKey): TutorialState => (isCompleted(input.progress, key) ? "done" : key === current ? "current" : "todo");

  const stages: JourneyStageView[] = [];
  for (const stage of definition.stages) {
    const tutorials = stage.tutorials.filter(offered).map((key) => ({ key, minutes: minutesOf.get(key)!, state: tutorialState(key) }));
    const gestures = stage.gestures.filter((gesture) => input.gestures[gesture] !== undefined).map((gesture) => ({ key: gesture, done: input.gestures[gesture] === true }));
    if (tutorials.length === 0 && gestures.length === 0) continue;
    const gestureDone = gestures.length > 0 && gestures.every((gesture) => gesture.done);
    const tutorialsDone = tutorials.length > 0 && tutorials.every((tutorial) => tutorial.state === "done");
    const completedAt = tutorials
      .map((tutorial) => input.progress.find((entry) => entry.itemKey === keyOf(tutorial.key))?.completedAt ?? null)
      .filter((date): date is Date => date !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    const done = gestureDone || tutorialsDone;
    stages.push({
      key: stage.key,
      number: stages.length + 1,
      state: done ? "done" : tutorials.some((tutorial) => tutorial.state === "current") ? "current" : "todo",
      tutorials,
      gestures,
      minutes: tutorials.filter((tutorial) => tutorial.state !== "done").reduce((sum, tutorial) => sum + tutorial.minutes, 0),
      doneAt: done ? (completedAt ?? null) : null,
    });
  }
  // « Ensuite » : la seule étape suivante, celle en cours si un tutoriel l'est, sinon la première à faire.
  const next = stages.find((stage) => stage.state === "current") ?? stages.find((stage) => stage.state === "todo") ?? null;
  if (next && next.state === "todo") next.state = "next";
  const inStages = new Set(stages.flatMap((stage) => stage.tutorials.map((tutorial) => tutorial.key)));
  const others = definition.others.filter((key) => offered(key) && !inStages.has(key)).map((key) => ({ key, minutes: minutesOf.get(key)!, state: tutorialState(key) }));
  const done = stages.filter((stage) => stage.state === "done").length;
  return {
    choice: input.choice,
    stages,
    others,
    done,
    total: stages.length,
    remainingMinutes: stages.filter((stage) => stage.state !== "done").reduce((sum, stage) => sum + stage.minutes, 0),
    current,
    next: done === stages.length ? null : next,
  };
}

// Ce que la personne fait ensuite dans une étape : la première marche pas encore faite dans l'espace
// (« Le faire sur mon mariage »), sinon le premier tutoriel pas encore fait.
export function nextTutorial(stage: JourneyStageView): TutorialKey | null {
  return stage.tutorials.find((tutorial) => tutorial.state === "current")?.key ?? stage.tutorials.find((tutorial) => tutorial.state !== "done")?.key ?? null;
}

export function nextGesture(stage: JourneyStageView): JourneyGesture | null {
  return stage.gestures.find((gesture) => !gesture.done)?.key ?? null;
}

// État d'un tutoriel dans l'ordre du parcours (le tutoriel conseillé après un tutoriel terminé, panneau des
// tutoriels) : faits, celui en cours, puis le premier à faire de l'étape « Ensuite ».
export function journeyStates(available: TutorialDefinition[], progress: readonly HelpProgressEntry[], path: JourneyPath = "scratch"): Map<TutorialKey, TutorialState> {
  const view = buildJourney({ choice: { path, by: "default" }, available, progress, gestures: {} });
  const states = new Map<TutorialKey, TutorialState>();
  for (const stage of view.stages) for (const tutorial of stage.tutorials) states.set(tutorial.key, tutorial.state);
  for (const tutorial of view.others) states.set(tutorial.key, tutorial.state);
  if (!view.current) {
    const first = view.stages.flatMap((stage) => stage.tutorials).find((tutorial) => tutorial.state !== "done");
    if (first) states.set(first.key, "next");
  }
  return states;
}
