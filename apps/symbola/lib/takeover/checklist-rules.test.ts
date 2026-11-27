// Lot 71f (EVT-02, UX-01, UX-06 ; spécification du lot 71, § 5.6 ; R7 à R9, I7) — ce qui reste à compléter
// après une reprise, en règles pures. Horloge simulée : les jours de Paris sont donnés aux règles.
import { describe, expect, it } from "vitest";
import {
  checklistBlock,
  checklistPoints,
  completeSlots,
  pendingPoints,
  runningStep,
  slotsWithoutAmount,
  takeoverFileCount,
  takeoverFinishedAt,
  takeoverMark,
  type ChecklistFacts,
  type TakeoverStepFacts,
} from "./checklist-rules";

// « Léa & Hugo », le lendemain de la reprise : un total sans détail, deux contrats non signés, aucune tâche,
// sept heures de fin, aucun lien, invités non renseignés.
const LEA_HUGO: ChecklistFacts = {
  remainingCents: 2_165_050,
  slotsWithoutAmount: 12,
  unsignedContracts: ["Les P'tits Loups", "Belles Carrosseries"],
  taskCount: 0,
  missingEndTimes: 7,
  hasClientLink: false,
  guestsKnown: false,
};

const ALL_DONE: ChecklistFacts = { remainingCents: 0, slotsWithoutAmount: 0, unsignedContracts: [], taskCount: 14, missingEndTimes: 0, hasClientLink: true, guestsKnown: true };

describe("EVT-02 — « À compléter après la reprise » (lot 71f, critère 1)", () => {
  it("les six points, dans l'ordre, chacun avec son nombre ; aucun n'est compté fait", () => {
    const points = checklistPoints(LEA_HUGO);
    expect(points.map((point) => [point.key, point.count, point.done])).toEqual([
      ["amounts", 12, false],
      ["contracts", 2, false],
      ["tasks", 1, false],
      ["endTimes", 7, false],
      ["clientLink", 1, false],
      ["guests", 1, false],
    ]);
    expect(points[0]!.remainingCents).toBe(2_165_050);
    expect(points[1]!.names).toEqual(["Les P'tits Loups", "Belles Carrosseries"]);
    expect(pendingPoints(points)).toHaveLength(6);
  });

  it("un reste à répartir suffit à garder le point des montants, même si chaque poste a un prévu", () => {
    const [amounts] = checklistPoints({ ...ALL_DONE, remainingCents: 100 });
    expect(amounts).toMatchObject({ key: "amounts", done: false, remainingCents: 100 });
  });

  it("un fichier sans total et des postes chiffrés : le point des montants est fait", () => {
    expect(checklistPoints({ ...ALL_DONE, remainingCents: null }).every((point) => point.done)).toBe(true);
  });
});

describe("EVT-02 — Un point fait passe en bas, coché (critère 2)", () => {
  it("le nombre d'invités saisi : le point passe en dernier, fait", () => {
    const points = checklistPoints({ ...LEA_HUGO, guestsKnown: true });
    expect(points.at(-1)).toMatchObject({ key: "guests", done: true, count: 0 });
    expect(pendingPoints(points).map((point) => point.key)).toEqual(["amounts", "contracts", "tasks", "endTimes", "clientLink"]);
    const block = checklistBlock(points, null, "2026-11-25");
    expect(block).toMatchObject({ kind: "open", done: 1, total: 6 });
  });
});

describe("EVT-02 — R9 : « Reprise complétée le … », puis le bloc disparaît (critère 2, horloge simulée)", () => {
  const done = checklistPoints(ALL_DONE);

  it("tant qu'un point reste, le bloc est ouvert", () => {
    expect(checklistBlock(checklistPoints(LEA_HUGO), null, "2026-11-25").kind).toBe("open");
  });

  it("la première liste vide se date du jour", () => {
    expect(checklistBlock(done, null, "2026-12-02")).toMatchObject({ kind: "completed", completedOn: "2026-12-02" });
  });

  it("6e et 7e jour : « Reprise complétée le 2 déc. » ; 8e jour : le bloc a disparu", () => {
    expect(checklistBlock(done, "2026-12-02", "2026-12-08")).toMatchObject({ kind: "completed", completedOn: "2026-12-02" });
    expect(checklistBlock(done, "2026-12-02", "2026-12-09")).toMatchObject({ kind: "completed" });
    expect(checklistBlock(done, "2026-12-02", "2026-12-10")).toEqual({ kind: "hidden" });
  });

  it("à cheval sur le passage à l'heure d'été, les jours se comptent en jours de calendrier", () => {
    expect(checklistBlock(done, "2027-03-24", "2027-03-31").kind).toBe("completed");
    expect(checklistBlock(done, "2027-03-24", "2027-04-01").kind).toBe("hidden");
  });

  it("un point qui se défait dans les sept jours rouvre la liste ; passé sept jours, plus rien ne revient", () => {
    const undone = checklistPoints({ ...ALL_DONE, hasClientLink: false });
    expect(checklistBlock(undone, "2026-12-02", "2026-12-05").kind).toBe("open");
    expect(checklistBlock(undone, "2026-12-02", "2026-12-20")).toEqual({ kind: "hidden" });
  });
});

const steps = (states: Partial<Record<TakeoverStepFacts["kind"], TakeoverStepFacts["state"]>>, overrides: Partial<Record<TakeoverStepFacts["kind"], Partial<TakeoverStepFacts>>> = {}): TakeoverStepFacts[] =>
  (["vendor_book", "event", "budget", "event_vendors", "tasks", "program"] as const).map((kind) => ({
    kind,
    state: states[kind] ?? "todo",
    importId: states[kind] === "done" || states[kind] === "in_progress" ? `import-${kind}` : null,
    decidedAt: states[kind] && states[kind] !== "todo" ? new Date("2026-11-24T09:00:00Z") : null,
    ...overrides[kind],
  }));

describe("EVT-07 — La marque « Repris » de la liste et d'« Aujourd'hui » (critère 5)", () => {
  it("« Repris · 3 fichiers sur 6 » tant qu'une ligne reste à régler", () => {
    expect(takeoverMark({ steps: steps({ vendor_book: "done", event: "done", budget: "in_progress", tasks: "no_file" }), completedAt: null, pendingPoints: 6 })).toEqual({ kind: "files", settled: 3, total: 6 });
  });

  it("« Repris · 6 points à compléter » une fois les six lignes réglées", () => {
    const all = steps({ vendor_book: "done", event: "done", budget: "no_file", event_vendors: "done", tasks: "no_file", program: "done" });
    expect(takeoverMark({ steps: all, completedAt: null, pendingPoints: 6 })).toEqual({ kind: "points", count: 6 });
  });

  it("la marque quitte la ligne une fois la reprise complétée", () => {
    const all = steps({ vendor_book: "done", event: "done", budget: "no_file", event_vendors: "done", tasks: "no_file", program: "done" });
    expect(takeoverMark({ steps: all, completedAt: new Date("2026-12-02T10:00:00Z"), pendingPoints: 0 })).toBeNull();
    expect(takeoverMark({ steps: all, completedAt: null, pendingPoints: 0 })).toBeNull();
  });

  it("« de 4 fichiers » : les lignes faites par un fichier, pas le mariage saisi à la main", () => {
    const lea = steps({ vendor_book: "done", event: "done", budget: "no_file", event_vendors: "done", tasks: "no_file", program: "done" });
    expect(takeoverFileCount(lea)).toBe(4);
    const typed = steps({ vendor_book: "done", event: "done", budget: "done" }, { event: { importId: null } });
    expect(takeoverFileCount(typed)).toBe(2);
  });

  it("l'import en cours se nomme ; la fin date du dernier réglage", () => {
    expect(runningStep(steps({ vendor_book: "done", event: "done", budget: "in_progress" }))).toBe("budget");
    expect(runningStep(steps({ vendor_book: "done" }))).toBeNull();
    expect(takeoverFinishedAt(steps({ vendor_book: "done" }))).toBeNull();
    const all = steps({ vendor_book: "done", event: "done", budget: "no_file", event_vendors: "done", tasks: "no_file", program: "done" }, { program: { decidedAt: new Date("2026-11-24T17:30:00Z") } });
    expect(takeoverFinishedAt(all)?.toISOString()).toBe("2026-11-24T17:30:00.000Z");
  });
});

describe("BUD-01 — I7 : « N postes complets sur M », pour tous les mariages", () => {
  it("complet : un prestataire retenu et un prévu connu ; « Retenu » sans montant ne compte pas", () => {
    const slots = [
      { status: "contract_signed", plannedCents: 1_200_000 },
      { status: "retained", plannedCents: null },
      { status: "retained", plannedCents: 0 },
      { status: "to_find", plannedCents: 50_000 },
      { status: "not_required", plannedCents: null },
    ];
    expect(completeSlots(slots)).toEqual({ complete: 2, total: 4 });
    expect(slotsWithoutAmount(slots)).toBe(1);
  });

  it("un mariage repris d'un PDF, douze postes retenus sans montant : « 0 sur 12 »", () => {
    const slots = Array.from({ length: 12 }, () => ({ status: "retained", plannedCents: null }));
    expect(completeSlots(slots)).toEqual({ complete: 0, total: 12 });
    expect(slotsWithoutAmount(slots)).toBe(12);
  });
});
