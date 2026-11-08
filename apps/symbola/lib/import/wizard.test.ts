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
    steps = importWizardSteps({ ...base, mapping: [field(0)], matches, reviewed: { types: true, matches: true } });
    expect(nextImportStep(steps)).toBe("confirm");
  });

  it("hors prestataires, pas d'étape « Types » ; un fichier encore en lecture reste à l'étape « Fichier »", () => {
    expect(importWizardSteps({ ...base, entityType: "tasks", mapping: [field(0)], matches: null }).map((step) => step.key)).toEqual(["file", "columns", "matches", "confirm"]);
    expect(nextImportStep(importWizardSteps({ ...base, entityType: "event_sheets", readingDone: false, mapping: null, matches: null }))).toBe("file");
  });
});
