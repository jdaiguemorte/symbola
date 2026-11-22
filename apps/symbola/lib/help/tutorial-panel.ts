// Lot 63f (HUB-11, HUB-10 ; ADR 0104 ; maquette M10) — le tutoriel en cours, dans un panneau
// latéral qui reste pendant la navigation dans l'exemple : ses étapes (cochées quand l'action est
// faite), l'étape en cours et l'écran où la faire. Le panneau paraît dès que l'exemple est créé
// (étape « faire », « regarder » ou « terminer ») ; avant, le tutoriel se lit sur sa page.
// Côté serveur seulement : les étapes et leurs écrans viennent des scripts (lib/help/tutorials.ts).
import { getTranslations } from "next-intl/server";
import type { HelpProgressEntry } from "@/modules/hub/service";
import type { TutorialDefinition, TutorialKey } from "./catalog";
import { isInProgress, tutorialInProgress } from "./journey";
import { TUTORIAL_SCRIPTS, type StepKind, type TutorialStep } from "./tutorials";

export type PanelStepState = "done" | "current" | "todo";

export type TutorialPanelState = {
  key: TutorialKey;
  title: string;
  index: number;
  total: number;
  steps: { title: string; state: PanelStepState }[];
  current: { kind: StepKind; title: string; body: string; href: string | null };
  // Étape suivante : son écran, pour « Étape suivante » une fois l'étape en cours faite.
  nextHref: string | null;
  keepLabel: string | null;
  dropLabel: string;
};

const PANEL_KINDS: StepKind[] = ["do", "look", "finish"];

export function stepHref(step: TutorialStep | undefined, context: Record<string, string>): string | null {
  return step?.href && (step.kind === "do" || step.kind === "look") ? step.href(context) : null;
}

// L'étape où en est le tutoriel, et si le panneau la montre.
export function panelStep(steps: TutorialStep[], entry: HelpProgressEntry | undefined): number | null {
  if (!isInProgress(entry)) return null;
  const index = Math.min(entry!.step, steps.length - 1);
  return PANEL_KINDS.includes(steps[index]!.kind) ? index : null;
}

export async function loadTutorialPanel(available: TutorialDefinition[], progress: HelpProgressEntry[]): Promise<TutorialPanelState | null> {
  const key = tutorialInProgress(available, progress);
  if (!key) return null;
  const script = TUTORIAL_SCRIPTS[key];
  const entry = progress.find((candidate) => candidate.itemKey === `tutorial:${key}`);
  const index = panelStep(script.steps, entry);
  if (index === null) return null;
  const t = await getTranslations("Tutorials");
  const tCenter = await getTranslations("HelpCenter");
  const texts = t.raw(`${key}.steps`) as { title: string; body: string }[];
  const context = entry?.context ?? {};
  const step = script.steps[index]!;
  return {
    key,
    title: tCenter(`items.${key}.title`),
    index,
    total: script.steps.length,
    steps: texts.map((text, position) => ({ title: text.title, state: position < index ? "done" : position === index ? "current" : "todo" })),
    current: { kind: step.kind, title: texts[index]!.title, body: texts[index]!.body, href: stepHref(step, context) },
    nextHref: stepHref(script.steps[index + 1], context),
    keepLabel: script.keepable ? t(`${key}.keep`) : null,
    dropLabel: script.keepable ? t(`${key}.drop`) : t("finishAndDelete"),
  };
}
