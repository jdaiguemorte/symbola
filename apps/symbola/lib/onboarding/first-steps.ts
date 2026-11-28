// Lot 72b (HUB-11, AIDE-04 ; spécification du lot 72, § 5.2 ; maquette 13 du lot 68) — « Pour bien démarrer »
// en une ligne, en bas de l'accueil : ce qui est fait sur le total, l'étape suivante. Masquée par la personne
// (`first_steps_hidden`), ou une fois tout fait, elle disparaît.
// Lot 74f (HUB-11 ; maquette 28 ; C-10) : ses étapes sont celles du parcours des tutoriels (le même compte
// sur l'accueil, dans « Aide » et dans « Tutoriels ») ; « Continuer » ouvre le geste qui reste dans l'espace,
// sinon le tutoriel suivant de l'étape.
import { tutorialHref } from "@/lib/help/catalog";
import { nextGesture, nextTutorial, type JourneyPath, type JourneyStageView, type JourneyView } from "@/lib/help/journey";
import { GESTURE_HREFS } from "./checklist";

export type FirstStepsLine = { path: JourneyPath; done: number; total: number; next: JourneyStageView; href: string; remaining: JourneyStageView[] };

export function stageHref(stage: JourneyStageView): string {
  const gesture = nextGesture(stage);
  if (gesture) return GESTURE_HREFS[gesture];
  const tutorial = nextTutorial(stage);
  return tutorial ? tutorialHref(tutorial) : "/tutoriels";
}

export function firstStepsLine(journey: JourneyView | null, hidden: boolean): FirstStepsLine | null {
  if (hidden || !journey || !journey.next) return null;
  return {
    path: journey.choice.path,
    done: journey.done,
    total: journey.total,
    next: journey.next,
    href: stageHref(journey.next),
    remaining: journey.stages.filter((stage) => stage.state !== "done"),
  };
}
