// Lot 16 (IMP-11) — assistant d'import : un seul service décide de l'étape
// suivante ; une étape sans rien à décider est faite d'office.
import { describe, expect, it } from "vitest";
import type { ImportColumnChoice } from "@/modules/hub/service";
import { importWizardSteps, nextImportStep } from "./wizard";

const field = (columnIndex: number): ImportColumnChoice => ({ columnIndex, fieldKey: "name", target: "field", confidence: 100, confirmed: true });
const none = (columnIndex: number): ImportColumnChoice => ({ columnIndex, fieldKey: null, target: "none", confidence: 0, confirmed: true });
const row = (rowIndex: number, status: "proposed" | "accepted" | "refused" | null) =>
  ({ rowIndex, lineNumber: rowIndex + 2, values: {}, errors: [], options: [], match: status ? { rowIndex, candidateId: "c", score: 90, status, manual: false, label: null, event: null } : null }) as never;

const base = { entityType: "vendors" as const, rowCount: 3, readingDone: true, reviewed: {} };

describe("IMP-11 — Assistant linéaire", () => {
  it("les colonnes restent à faire tant qu'une colonne attend une décision", () => {
    const steps = importWizardSteps({ ...base, mapping: [field(0), none(1)], matches: null });
    expect(steps.map((step) => step.key)).toEqual(["file", "columns", "types", "matches", "confirm"]);
    expect(nextImportStep(steps)).toBe("columns");
  });

  it("quand une étape n'a rien à décider, elle est marquée faite et franchie automatiquement, avec son résumé", () => {
    const vendorTypes = [{ label: "Traiteur", rowCount: 2, typeId: "t", score: 100, manual: false, typeLabel: "Traiteur", target: { kind: "existing", typeId: "t" } }] as never;
    const steps = importWizardSteps({ ...base, mapping: [field(0)], matches: { rows: [row(0, null), row(1, null)], vendorTypes } });
    expect(steps.find((step) => step.key === "types")).toMatchObject({ done: true, summary: { key: "types", values: { labels: 1, created: 0, unclassified: 0 } } });
    expect(steps.find((step) => step.key === "matches")).toMatchObject({ done: true, summary: { values: { creations: 2, updates: 0 } } });
    expect(nextImportStep(steps)).toBe("confirm");
  });

  it("des types à créer ou des doublons proposés attendent la planner, jusqu'à « Continuer »", () => {
    const vendorTypes = [{ label: "Coiffeur(se)", rowCount: 1, typeId: null, score: 100, manual: false, typeLabel: null, target: { kind: "starter", starterKey: "hair_makeup" } }] as never;
    const matches = { rows: [row(0, "proposed")], vendorTypes };
    let steps = importWizardSteps({ ...base, mapping: [field(0)], matches });
    expect(nextImportStep(steps)).toBe("types");
    steps = importWizardSteps({ ...base, mapping: [field(0)], matches, reviewed: { types: true } });
    expect(nextImportStep(steps)).toBe("matches");
    // Lot 67a (HUB-14 ; R04) : « Continuer » ne vaut pas décision, la proposition attend toujours.
    steps = importWizardSteps({ ...base, mapping: [field(0)], matches, reviewed: { types: true, matches: true } });
    expect(nextImportStep(steps)).toBe("matches");
    steps = importWizardSteps({ ...base, mapping: [field(0)], matches: { rows: [row(0, "accepted")], vendorTypes }, reviewed: { types: true, matches: true } });
    expect(nextImportStep(steps)).toBe("confirm");
  });

  it("HUB-14 (lot 67a) — un rapprochement proposé sans décision : étape non terminée, comptée « à décider » et non « nouveau »", () => {
    const matches = { rows: [row(0, "proposed"), row(1, "proposed"), row(2, null), row(3, "refused")], vendorTypes: [] } as never;
    // Lot 71d : un budget a son propre compte (« N choix à faire ») ; la règle se lit sur des tâches.
    const steps = importWizardSteps({ ...base, entityType: "tasks", mapping: [field(0)], matches, reviewed: { matches: true } });
    const step = steps.find((entry) => entry.key === "matches");
    expect(step).toMatchObject({ done: false, summary: { values: { undecided: 2, creations: 2, updates: 0 } } });
    expect(nextImportStep(steps)).toBe("matches");
  });

  it("HUB-14 (lot 67a) — une fois tout décidé, l'étape est terminée sans « Continuer » de plus", () => {
    const matches = { rows: [row(0, "accepted"), row(1, "refused")], vendorTypes: [] } as never;
    const steps = importWizardSteps({ ...base, entityType: "tasks", mapping: [field(0)], matches, reviewed: { matches: true } });
    expect(steps.find((entry) => entry.key === "matches")).toMatchObject({ done: true, summary: { values: { undecided: 0, creations: 1, updates: 1 } } });
  });

  it("hors prestataires, pas d'étape « Types » ; un fichier encore en lecture reste à l'étape « Fichier »", () => {
    expect(importWizardSteps({ ...base, entityType: "tasks", mapping: [field(0)], matches: null }).map((step) => step.key)).toEqual(["file", "columns", "matches", "confirm"]);
    expect(nextImportStep(importWizardSteps({ ...base, entityType: "event_sheets", readingDone: false, mapping: null, matches: null }))).toBe("file");
  });
});

describe("HUB-14 — Rapprochements vérifiables (lot 63b)", () => {
  it("une proposition « À vérifier » (deux prestataires par défaut) garde l'étape « Doublons » ouverte tant qu'elle n'a pas été vue", () => {
    const doubtful = (reviewed: boolean) =>
      ({ rowIndex: 0, lineNumber: 2, values: {}, errors: [], options: [], match: { rowIndex: 0, candidateId: "c", score: 70, status: "refused", manual: false, toVerify: true, reviewed, label: null, event: null } }) as never;
    const vendorTypes = [] as never;
    let steps = importWizardSteps({ ...base, mapping: [field(0)], matches: { rows: [doubtful(false)], vendorTypes } });
    expect(nextImportStep(steps)).toBe("matches");
    // Par défaut, la ligne crée une fiche.
    expect(steps.find((step) => step.key === "matches")?.summary).toMatchObject({ values: { creations: 1, updates: 0, proposed: 1 } });
    steps = importWizardSteps({ ...base, mapping: [field(0)], matches: { rows: [doubtful(true)], vendorTypes } });
    expect(nextImportStep(steps)).toBe("confirm");
  });
});

// Lot 71c (HUB-14 ; maquette 07) : « Questions », entre les colonnes et les doublons, seulement s'il y a
// une réponse à donner ; tant qu'il en manque une, l'assistant s'y arrête.
describe("HUB-14 — L'étape « Questions » (lot 71c)", () => {
  const budget = { entityType: "budget_lines" as const, rowCount: 14, readingDone: true, reviewed: {}, mapping: [field(0)] };
  it("sans question, l'étape n'existe pas", () => {
    expect(importWizardSteps({ ...budget, matches: { rows: [row(0, null)] } as never, questions: null }).map((step) => step.key)).toEqual(["file", "columns", "matches", "confirm"]);
    expect(importWizardSteps({ ...budget, matches: { rows: [row(0, null)] } as never, questions: { asked: 0, missing: 0 } }).map((step) => step.key)).toEqual(["file", "columns", "matches", "confirm"]);
  });
  it("avec des réponses à donner, l'assistant s'arrête à « Questions », avant les doublons ; répondues, il passe", () => {
    let steps = importWizardSteps({ ...budget, matches: { rows: [row(0, null)] } as never, questions: { asked: 2, missing: 2 } });
    expect(steps.map((step) => step.key)).toEqual(["file", "columns", "questions", "matches", "confirm"]);
    expect(nextImportStep(steps)).toBe("questions");
    expect(steps.find((step) => step.key === "matches")?.done).toBe(false);
    steps = importWizardSteps({ ...budget, matches: { rows: [row(0, null)] } as never, questions: { asked: 2, missing: 0 } });
    expect(steps.find((step) => step.key === "questions")).toMatchObject({ done: true, summary: { key: "questions", values: { asked: 2, missing: 0 } } });
    expect(nextImportStep(steps)).toBe("confirm");
  });
});

// Lot 71d (HUB-14 ; spécification du lot 71, § 5.4, critère 4 ; maquette 08) : la frise d'un budget dit
// combien de choix restent à « Doublons », et l'étape n'est faite qu'une fois chacun tranché.
describe("HUB-14 — « Doublons » d'un budget dans la frise (lot 71d)", () => {
  it("un poste sans ligne ou un doublon possible à trancher garde l'étape ouverte ; tranchés, elle est faite", () => {
    const matches = { rows: [row(0, "accepted")], vendorTypes: [] } as never;
    const open = importWizardSteps({ ...base, entityType: "budget_lines", mapping: [field(0)], matches, reviewed: { matches: true }, doublonsPending: 2 });
    expect(open.find((step) => step.key === "matches")).toMatchObject({ done: false, summary: { key: "doublons", values: { pending: 2 } } });
    expect(nextImportStep(open)).toBe("matches");
    const done = importWizardSteps({ ...base, entityType: "budget_lines", mapping: [field(0)], matches, reviewed: { matches: true }, doublonsPending: 0 });
    expect(nextImportStep(done)).toBe("confirm");
  });
});
