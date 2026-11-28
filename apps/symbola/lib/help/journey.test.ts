import { describe, expect, it } from "vitest";
import type { HelpProgressEntry } from "@/modules/hub/service";
import { TUTORIALS, type TutorialDefinition } from "./catalog";
import { JOURNEYS, JOURNEY_ITEM_KEY, buildJourney, chooseJourney, isInProgress, journeyStates, tutorialInProgress, type JourneyChoice, type JourneyGestures } from "./journey";

const entry = (key: string, status: HelpProgressEntry["status"], step: number, context: Record<string, string> | null = null, at = 1): HelpProgressEntry => ({
  itemKey: `tutorial:${key}`,
  status,
  step,
  context,
  updatedAt: new Date(at),
  completedAt: status === "completed" ? new Date(at) : null,
});

const takeover: JourneyChoice = { path: "takeover", by: "answer" };
const scratch: JourneyChoice = { path: "scratch", by: "answer" };
const allGestures: JourneyGestures = { takeover: false, takeover_complete: false, first_event: false, first_vendor: false, essentials: false };
const journey = (choice: JourneyChoice, progress: HelpProgressEntry[] = [], gestures: JourneyGestures = allGestures, available: TutorialDefinition[] = TUTORIALS) =>
  buildJourney({ choice, available, progress, gestures });

describe("HUB-11 — Deux parcours de tutoriels, choisis par la réponse au démarrage (lot 74f, D6, maquette 28)", () => {
  it("« Je reprends » : reprendre, compléter un mariage repris, vos prestataires, le rétroplanning et le programme, devis et factures", () => {
    expect(journey(takeover).stages.map((stage) => stage.key)).toEqual(["takeover", "complete", "vendors", "templates", "sales"]);
  });

  it("« Je pars de zéro » : créer votre premier mariage, son rétroplanning, ses prestataires, devis et factures", () => {
    expect(journey(scratch).stages.map((stage) => stage.key)).toEqual(["first_event", "templates", "vendors", "sales"]);
  });

  it("les devis ne sont en tête d'aucun parcours ; chaque parcours range les douze tutoriels une seule fois", () => {
    for (const definition of Object.values(JOURNEYS)) {
      expect(definition.stages[0]!.tutorials).not.toContain("documents");
      const keys = [...definition.stages.flatMap((stage) => stage.tutorials), ...definition.others];
      expect(new Set(keys).size).toBe(keys.length);
      expect([...keys].sort()).toEqual(TUTORIALS.map((tutorial) => tutorial.key).sort());
    }
    expect(TUTORIALS).toHaveLength(12);
  });

  it("la reprise est la première étape du premier parcours et un « autre tutoriel » du second", () => {
    expect(journey(takeover).stages[0]!.tutorials.map((tutorial) => tutorial.key)).toEqual(["import"]);
    expect(journey(scratch).others.map((tutorial) => tutorial.key)).toContain("import");
  });

  it("le parcours suit la réponse de l'assistant ; « Changer de parcours » le change et le garde ; sans réponse, « Je pars de zéro »", () => {
    expect(chooseJourney("yes", [])).toEqual({ path: "takeover", by: "answer" });
    expect(chooseJourney("no", [])).toEqual({ path: "scratch", by: "answer" });
    expect(chooseJourney(null, [])).toEqual({ path: "scratch", by: "default" });
    const chosen: HelpProgressEntry = { itemKey: JOURNEY_ITEM_KEY, status: "started", step: 0, context: { path: "scratch" }, updatedAt: new Date(1), completedAt: null };
    expect(chooseJourney("yes", [chosen])).toEqual({ path: "scratch", by: "choice" });
    // Un choix illisible ne vaut rien : la réponse reprend la main.
    expect(chooseJourney("yes", [{ ...chosen, context: { path: "autre" } }])).toEqual({ path: "takeover", by: "answer" });
  });

  it("ce qui est fait reste fait dans l'autre parcours", () => {
    const progress = [entry("retroplanning-template", "completed", 5), entry("day-program", "completed", 4)];
    expect(journey(takeover, progress).stages.find((stage) => stage.key === "templates")!.state).toBe("done");
    expect(journey(scratch, progress).stages.find((stage) => stage.key === "templates")!.state).toBe("done");
  });
});

describe("HUB-11 — Une étape se coche par le geste fait dans l'espace (lot 74f, critère 4)", () => {
  it("le premier mariage créé coche « Créer votre premier mariage », tutoriel suivi ou non", () => {
    const view = journey(scratch, [], { ...allGestures, first_event: true });
    expect(view.stages[0]).toMatchObject({ key: "first_event", state: "done" });
    expect(view.done).toBe(1);
    expect(view.next!.key).toBe("templates");
    expect(view.next!.state).toBe("next");
  });

  it("la reprise ouverte coche « Reprendre un mariage en cours » ; le premier prestataire coche « Vos prestataires »", () => {
    const view = journey(takeover, [], { ...allGestures, takeover: true, first_vendor: true });
    expect(view.stages.filter((stage) => stage.state === "done").map((stage) => stage.key)).toEqual(["takeover", "vendors"]);
    expect(view.next!.key).toBe("complete");
  });

  it("« Régler l'essentiel » est la marche de « Devis et factures », « Ajouter un premier prestataire » celle de « Vos prestataires »", () => {
    const view = journey(scratch);
    expect(view.stages.find((stage) => stage.key === "sales")!.gestures).toEqual([{ key: "essentials", done: false }]);
    expect(view.stages.find((stage) => stage.key === "vendors")!.gestures).toEqual([{ key: "first_vendor", done: false }]);
  });

  it("tous les tutoriels d'une étape terminés la cochent aussi ; « Ensuite » est la seule étape suivante, les autres « À faire »", () => {
    const view = journey(scratch, [entry("event-page", "completed", 5)]);
    expect(view.stages.map((stage) => stage.state)).toEqual(["done", "next", "todo", "todo"]);
  });

  it("un tutoriel commencé met son étape « En cours » à la place d'« Ensuite »", () => {
    const view = journey(scratch, [entry("vendor-quotes", "started", 2)]);
    expect(view.current).toBe("vendor-quotes");
    expect(view.stages.map((stage) => stage.state)).toEqual(["todo", "todo", "current", "todo"]);
  });

  it("les minutes restantes ne comptent que les tutoriels pas faits des étapes pas faites", () => {
    const fresh = journey(scratch);
    const total = fresh.stages.flatMap((stage) => stage.tutorials).reduce((sum, tutorial) => sum + tutorial.minutes, 0);
    expect(fresh.remainingMinutes).toBe(total);
    const later = journey(scratch, [entry("documents", "completed", 6)], { ...allGestures, first_event: true });
    expect(later.remainingMinutes).toBe(total - 2 - 4);
  });

  it("tout fait : plus d'étape suivante (la ligne de l'accueil disparaît)", () => {
    const view = journey(scratch, [], { ...allGestures, first_event: true, first_vendor: true, essentials: true, takeover: true }, TUTORIALS.filter((tutorial) => tutorial.module !== "events"));
    expect(view.next).toBeNull();
    expect(view.done).toBe(view.total);
  });
});

describe("ARC-06 — Un parcours sans les modules non souscrits (lot 74f)", () => {
  it("sans le module Évènements, ni le premier mariage ni la reprise : il reste ce qui sert", () => {
    const available = TUTORIALS.filter((tutorial) => tutorial.module !== "events");
    const view = buildJourney({ choice: takeover, available, progress: [], gestures: { essentials: false } });
    expect(view.stages.map((stage) => stage.key)).toEqual(["takeover", "sales"]);
    expect(view.stages[0]!.gestures).toEqual([]);
    expect(view.others.map((tutorial) => tutorial.key)).toEqual(["budget-simulation"]);
  });

  it("sans le carnet de prestataires, la marche « premier prestataire » n'existe pas et ne bloque rien", () => {
    const view = journey(scratch, [entry("vendor-quotes", "completed", 6)], { first_event: false, essentials: false });
    const vendors = view.stages.find((stage) => stage.key === "vendors")!;
    expect(vendors.gestures).toEqual([]);
    expect(vendors.state).toBe("done");
  });
});

describe("AIDE-10 — Un seul tutoriel en cours à la fois (lot 13)", () => {
  it("une invitation mise de côté à l'étape 0 n'est pas un tutoriel en cours", () => {
    expect(isInProgress(entry("catalog", "postponed", 0))).toBe(false);
    expect(isInProgress(entry("catalog", "started", 2))).toBe(true);
    expect(isInProgress(entry("catalog", "started", 0, { eventId: "x" }))).toBe(true);
    expect(isInProgress(entry("catalog", "completed", 4))).toBe(false);
  });

  it("deux tutoriels commencés : le plus récent est celui en cours", () => {
    expect(tutorialInProgress(TUTORIALS, [entry("catalog", "started", 1, null, 1), entry("day-program", "started", 1, null, 5)])).toBe("day-program");
  });

  it("le tutoriel conseillé ensuite suit l'ordre du parcours : faits, en cours, puis le premier à faire", () => {
    expect(journeyStates(TUTORIALS, []).get("event-page")).toBe("next");
    expect(journeyStates(TUTORIALS, [], "takeover").get("import")).toBe("next");
    const running = journeyStates(TUTORIALS, [entry("catalog", "completed", 4), entry("quote-signature", "started", 2)]);
    expect(running.get("catalog")).toBe("done");
    expect(running.get("quote-signature")).toBe("current");
    expect([...running.values()].filter((state) => state === "next")).toEqual([]);
  });
});

describe("AIDE-13 — Personnaliser ses devis et factures dans l'accompagnement", () => {
  it("le tutoriel des documents ouvre l'étape « Devis et factures » des deux parcours", () => {
    expect(JOURNEYS.takeover.stages.find((stage) => stage.key === "sales")!.tutorials[0]).toBe("documents");
    expect(JOURNEYS.scratch.stages.find((stage) => stage.key === "sales")!.tutorials[0]).toBe("documents");
  });

  it("il est proposé à la première visite de l'écran Documents, pour le module Devis et factures", () => {
    expect(TUTORIALS.find((tutorial) => tutorial.key === "documents")).toMatchObject({ module: "quotes", screen: "/devis/parametres/documents" });
  });
});
