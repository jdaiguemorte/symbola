// Lot 71a (HUB-14, PAR-01 ; spécification du lot 71, § 4.1 et § 5.1) — le compteur de la page de reprise
// (R4) et la ligne suivante, en règles pures ; sortes et états identiques en base et dans le contrat.
import { describe, expect, it } from "vitest";
import { nextTakeoverStep, TAKEOVER_STEP_KINDS, TAKEOVER_STEP_STATES, takeoverProgress, type TakeoverStepState } from "@symbola/contracts";
import { TAKEOVER_STEP_KINDS as DB_KINDS, TAKEOVER_STEP_STATES as DB_STATES } from "@symbola/db/schema/hub";

const steps = (states: TakeoverStepState[]) => TAKEOVER_STEP_KINDS.map((kind, index) => ({ kind, state: states[index] ?? "todo" }));

describe("PAR-01 — Le compteur d'une reprise (R4, lot 71a)", () => {
  it("compte les lignes faites, sans fichier et couvertes ; « 3 fichiers sur 6 »", () => {
    expect(takeoverProgress(steps(["done", "done", "in_progress", "covered", "todo", "no_file"]))).toEqual({ settled: 4, total: 6 });
    expect(takeoverProgress(steps(["done", "done", "done", "todo", "todo", "todo"]))).toEqual({ settled: 3, total: 6 });
    expect(takeoverProgress(steps([]))).toEqual({ settled: 0, total: 6 });
  });

  it("une ligne couverte par un import encore en cours compte ; la ligne en cours, non", () => {
    expect(takeoverProgress(steps(["done", "done", "in_progress", "covered"]))).toEqual({ settled: 3, total: 6 });
  });

  it("la ligne suivante est la première, dans l'ordre R2, qui n'est pas réglée ; aucune quand tout l'est", () => {
    expect(nextTakeoverStep(steps(["done", "todo"]))?.kind).toBe("event");
    expect(nextTakeoverStep(steps(["done", "done", "in_progress"]))?.kind).toBe("budget");
    expect(nextTakeoverStep(steps(["done", "done", "done", "covered", "no_file", "todo"]))?.kind).toBe("program");
    expect(nextTakeoverStep(steps(["done", "done", "done", "covered", "no_file", "done"]))).toBeNull();
  });

  it("sortes et états de la base identiques à ceux du contrat, dans le même ordre", () => {
    expect([...DB_KINDS]).toEqual([...TAKEOVER_STEP_KINDS]);
    expect([...DB_STATES]).toEqual([...TAKEOVER_STEP_STATES]);
  });
});
