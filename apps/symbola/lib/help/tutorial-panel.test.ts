// Lot 63f (HUB-11, HUB-10 ; ADR 0104 ; maquette M10) — le panneau latéral du tutoriel : il paraît
// une fois l'exemple créé, montre l'étape en cours et mène à son écran.
import { describe, expect, it } from "vitest";
import type { HelpProgressEntry } from "@/modules/hub/service";
import { panelStep, stepHref } from "./tutorial-panel";
import { TUTORIAL_SCRIPTS } from "./tutorials";

const entry = (step: number, context: Record<string, string> | null = { eventId: "e1", quoteId: "q1" }, status: HelpProgressEntry["status"] = "started"): HelpProgressEntry => ({
  itemKey: "tutorial:quote-signature",
  status,
  step,
  context,
  updatedAt: new Date("2026-11-21T10:00:00Z"),
  completedAt: null,
});

describe("HUB-11 — Tutoriel dans le panneau latéral", () => {
  const steps = TUTORIAL_SCRIPTS["quote-signature"].steps;

  it("pas de panneau avant l'exemple : l'explication et la création se lisent sur la page du tutoriel", () => {
    expect(panelStep(steps, undefined)).toBeNull();
    expect(panelStep(steps, entry(0, null))).toBeNull();
    expect(panelStep(steps, entry(1))).toBeNull();
  });

  it("le panneau montre l'étape « faire » en cours, puis la fin", () => {
    expect(steps[2]!.kind).toBe("do");
    expect(panelStep(steps, entry(2))).toBe(2);
    expect(panelStep(steps, entry(steps.length - 1))).toBe(steps.length - 1);
  });

  it("un tutoriel terminé n'a plus de panneau", () => {
    expect(panelStep(steps, entry(steps.length - 1, { eventId: "e1" }, "completed"))).toBeNull();
  });

  it("« Étape suivante » mène à l'écran de l'étape, sur l'exemple", () => {
    expect(stepHref(steps[2], { eventId: "e1", quoteId: "q1" })).toBe("/devis/q1");
    expect(stepHref(steps[0], {})).toBeNull();
    expect(stepHref(steps.at(-1), {})).toBeNull();
  });
});
