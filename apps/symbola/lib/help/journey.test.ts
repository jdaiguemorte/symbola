import { describe, expect, it } from "vitest";
import type { HelpProgressEntry } from "@/modules/hub/service";
import { TUTORIALS } from "./catalog";
import { JOURNEY, isInProgress, journeyStates, tutorialInProgress } from "./journey";

const entry = (key: string, status: HelpProgressEntry["status"], step: number, context: Record<string, string> | null = null, at = 1): HelpProgressEntry => ({
  itemKey: `tutorial:${key}`,
  status,
  step,
  context,
  updatedAt: new Date(at),
  completedAt: status === "completed" ? new Date(at) : null,
});

describe("AIDE-10 — Page Tutoriels en parcours", () => {
  it("le parcours couvre chaque tutoriel une seule fois, catalogue d'abord, import à part", () => {
    const keys = JOURNEY.flatMap((stage) => stage.tutorials);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(TUTORIALS.map((tutorial) => tutorial.key).sort());
    expect(JOURNEY[0]!.tutorials[0]).toBe("catalog");
    expect(JOURNEY.at(-1)!.tutorials).toEqual(["import"]);
  });

  it("une invitation mise de côté à l'étape 0 n'est pas un tutoriel en cours", () => {
    expect(isInProgress(entry("catalog", "postponed", 0))).toBe(false);
    expect(isInProgress(entry("catalog", "started", 2))).toBe(true);
    expect(isInProgress(entry("catalog", "started", 0, { eventId: "x" }))).toBe(true);
    expect(isInProgress(entry("catalog", "completed", 4))).toBe(false);
  });

  it("faits en vert, le tutoriel en cours, puis le suivant conseillé quand aucun n'est en cours", () => {
    const done = journeyStates(TUTORIALS, [entry("catalog", "completed", 4)]);
    expect(done.get("catalog")).toBe("done");
    expect(done.get("retroplanning-template")).toBe("next");
    expect(done.get("import")).toBe("todo");

    const running = journeyStates(TUTORIALS, [entry("catalog", "completed", 4), entry("quote-signature", "started", 2)]);
    expect(running.get("quote-signature")).toBe("current");
    expect(running.get("retroplanning-template")).toBe("todo");
  });

  it("deux tutoriels commencés : le plus récent est celui en cours", () => {
    expect(tutorialInProgress(TUTORIALS, [entry("catalog", "started", 1, null, 1), entry("day-program", "started", 1, null, 5)])).toBe("day-program");
  });
});
