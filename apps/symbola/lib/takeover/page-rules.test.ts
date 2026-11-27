// Lot 71b (HUB-14, PAR-01, UX-02, UX-08 ; spécification du lot 71, § 5.2 ; maquette 06) — la page « Reprendre
// un mariage en cours » en règles pures : l'état et la forme de chaque ligne, la ligne suivante (seule
// action principale), les lignes qui attendent le mariage, le compteur, la date limite de retrait et
// les points qui restent à compléter à la main.
import { describe, expect, it } from "vitest";
import { TAKEOVER_STEP_KINDS, type TakeoverStepKind, type TakeoverStepState } from "@symbola/contracts";
import {
  importFigureKey,
  takeoverImportEntityType,
  takeoverPageState,
  takeoverRows,
  toCompletePoints,
  withdrawDeadline,
  type TakeoverRowStep,
} from "./page-rules";

const at = new Date("2026-11-27T08:40:00Z");

function steps(states: Partial<Record<TakeoverStepKind, TakeoverStepState>>, imports: Partial<Record<TakeoverStepKind, string>> = {}): TakeoverRowStep[] {
  return TAKEOVER_STEP_KINDS.map((kind) => {
    const state = states[kind] ?? "todo";
    return { kind, state, importId: imports[kind] ?? null, decidedAt: state === "todo" ? null : at };
  });
}

describe("HUB-14 — La page de reprise : six lignes dans l'ordre (critère 1 du paquet 71b)", () => {
  it("la page vide montre six lignes numérotées dans l'ordre R2, une seule action principale, sur la ligne 1", () => {
    const rows = takeoverRows(steps({}), { eventExists: false });
    expect(rows.map((row) => [row.number, row.kind])).toEqual([
      [1, "vendor_book"],
      [2, "event"],
      [3, "budget"],
      [4, "event_vendors"],
      [5, "tasks"],
      [6, "program"],
    ]);
    expect(rows.filter((row) => row.primary !== null).map((row) => row.kind)).toEqual(["vendor_book"]);
    expect(rows[0]).toMatchObject({ next: true, primary: "drop", actions: ["drop", "noFile"] });
    expect(rows[1]).toMatchObject({ next: false, primary: null, actions: ["dropSheet", "enterNames"] });
  });

  it("les lignes 3 à 6 disent qu'elles attendent le mariage, sans bouton grisé", () => {
    const rows = takeoverRows(steps({}), { eventExists: false });
    for (const row of rows.slice(2)) expect(row).toMatchObject({ waiting: true, actions: [], primary: null });
    expect(rows.slice(0, 2).every((row) => !row.waiting)).toBe(true);
  });

  it("le mariage existe : les lignes 3 à 6 ont leurs boutons ; la ligne suivante porte le seul bouton plein", () => {
    const rows = takeoverRows(steps({ vendor_book: "done", event: "done" }), { eventExists: true });
    expect(rows.every((row) => !row.waiting)).toBe(true);
    expect(rows.filter((row) => row.next).map((row) => row.kind)).toEqual(["budget"]);
    expect(rows.find((row) => row.kind === "budget")).toMatchObject({ primary: "drop", actions: ["drop", "noFile"] });
    expect(rows.find((row) => row.kind === "tasks")).toMatchObject({ primary: null, actions: ["drop", "noFile"] });
  });
});

describe("HUB-14 — L'état de chaque ligne, en mots et par une forme (UX-08)", () => {
  it("fait : rond plein et coche ; en cours : rond tracé ; à faire : pointillés ; sans fichier ou avec le budget : tiret", () => {
    const rows = takeoverRows(
      steps({ vendor_book: "done", event: "done", budget: "in_progress", event_vendors: "covered", tasks: "no_file" }, { vendor_book: "i1", budget: "i2" }),
      { eventExists: true },
    );
    expect(rows.map((row) => [row.kind, row.shape])).toEqual([
      ["vendor_book", "done"],
      ["event", "done"],
      ["budget", "running"],
      ["event_vendors", "none"],
      ["tasks", "none"],
      ["program", "todo"],
    ]);
  });

  it("une ligne faite par un import mène à son bilan ; le mariage saisi à la main, à sa fiche", () => {
    const rows = takeoverRows(steps({ vendor_book: "done", event: "done" }, { vendor_book: "i1" }), { eventExists: true });
    expect(rows[0]).toMatchObject({ actions: ["seeSummary"], primary: null });
    expect(rows[1]).toMatchObject({ actions: ["openEvent"] });
    const fromSheet = takeoverRows(steps({ vendor_book: "done", event: "done" }, { event: "i3" }), { eventExists: true });
    expect(fromSheet[1]).toMatchObject({ actions: ["seeSummary"] });
  });

  it("un import laissé en plan se retrouve à sa ligne : « Continuer » (principal s'il est la suite) et « Abandonner cet import… » (critère 5)", () => {
    const rows = takeoverRows(steps({ vendor_book: "done", event: "done", budget: "in_progress" }, { budget: "i2" }), { eventExists: true });
    expect(rows.find((row) => row.kind === "budget")).toMatchObject({ next: true, primary: "continue", actions: ["continue", "abandon"] });
  });

  it("« Je n'ai pas ce fichier » règle la ligne et se défait par « Déposer un fichier » (critère 2)", () => {
    const rows = takeoverRows(steps({ vendor_book: "no_file" }), { eventExists: false });
    expect(rows[0]).toMatchObject({ shape: "none", next: false, actions: ["dropAgain"], primary: null });
    expect(rows[1]).toMatchObject({ next: true, primary: "dropSheet" });
  });

  it("la ligne couverte par le budget propose « Déposer un fichier quand même » (critère 4)", () => {
    const rows = takeoverRows(steps({ vendor_book: "done", event: "done", budget: "in_progress", event_vendors: "covered" }, { budget: "i2" }), { eventExists: true });
    expect(rows.find((row) => row.kind === "event_vendors")).toMatchObject({ actions: ["dropAnyway"], primary: null, next: false });
  });

  it("la page est terminée quand les six lignes sont réglées ; aucune ligne n'est alors « suivante »", () => {
    const all = steps({ vendor_book: "done", event: "done", budget: "no_file", event_vendors: "done", tasks: "no_file", program: "done" });
    expect(takeoverPageState(all)).toBe("done");
    expect(takeoverRows(all, { eventExists: true }).some((row) => row.next || row.primary)).toBe(false);
    expect(takeoverPageState(steps({ vendor_book: "done" }))).toBe("open");
  });
});

describe("HUB-14 — Ce que chaque ligne ouvre et dit de son import", () => {
  it("chaque ligne ouvre l'import de sa sorte ; les PDF des prestataires retenus et du programme restent sur la fiche (71e)", () => {
    expect(TAKEOVER_STEP_KINDS.map((kind) => takeoverImportEntityType(kind))).toEqual(["vendors", "event_sheets", "budget_lines", null, "tasks", null]);
  });

  it("le nombre d'une ligne faite se dit avec le nom de ce que l'import a écrit", () => {
    expect(importFigureKey("vendors")).toBe("vendors");
    expect(importFigureKey("budget_lines")).toBe("budgetLines");
    expect(importFigureKey("tasks")).toBe("tasks");
    expect(importFigureKey("event_sheets")).toBe("events");
    expect(importFigureKey("events")).toBe("events");
    expect(importFigureKey("contacts")).toBe("rows");
  });
});

describe("HUB-14 — La fin de la reprise (critère 6)", () => {
  it("la date limite de retrait est celle du premier import appliqué, plus le délai réglé", () => {
    const first = new Date("2026-11-24T17:00:00Z");
    expect(withdrawDeadline([new Date("2026-11-25T09:00:00Z"), first], 90)?.toISOString()).toBe("2027-02-22T17:00:00.000Z");
    expect(withdrawDeadline([], 90)).toBeNull();
  });

  it("compte ce qui reste à compléter à la main, chaque point avec son nombre ; jamais « tout est à jour » quand il en reste", () => {
    expect(toCompletePoints({ remainingCents: 2_165_050, taskCount: 0, missingEndTimes: 7, hasClientLink: false, guestsKnown: false })).toEqual([
      { key: "amounts", count: 1 },
      { key: "tasks", count: 1 },
      { key: "endTimes", count: 7 },
      { key: "clientLink", count: 1 },
      { key: "guests", count: 1 },
    ]);
    expect(toCompletePoints({ remainingCents: 0, taskCount: 3, missingEndTimes: 0, hasClientLink: true, guestsKnown: true })).toEqual([]);
    expect(toCompletePoints({ remainingCents: null, taskCount: 3, missingEndTimes: 0, hasClientLink: true, guestsKnown: true })).toEqual([]);
  });
});
