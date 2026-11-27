// Lot 72b (HUB-11, AIDE-04 ; spécification du lot 72, § 5.2 et J5 ; maquette 13 du lot 68) — « Pour bien
// démarrer » en une ligne, en bas de l'accueil : ce qui est fait sur le total, ce qui reste, l'étape
// suivante. Masquée par la personne (`first_steps_hidden`), ou une fois tout fait, elle disparaît. Les
// étapes restent celles de la liste actuelle (J5) ; le parcours du lot 74 viendra dedans.
import type { OnboardingChecklistKey } from "@symbola/starter-templates";
import type { ChecklistItem } from "./checklist";

export type FirstStepsLine = { done: number; total: number; remaining: OnboardingChecklistKey[]; next: ChecklistItem };

export function firstStepsLine(items: ChecklistItem[] | null, hidden: boolean): FirstStepsLine | null {
  if (hidden || !items) return null;
  const left = items.filter((item) => !item.done);
  const [next] = left;
  if (!next) return null;
  return { done: items.length - left.length, total: items.length, remaining: left.map((item) => item.key), next };
}
