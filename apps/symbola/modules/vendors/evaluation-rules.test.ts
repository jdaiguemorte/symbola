import { describe, expect, it } from "vitest";
import { averageTenths, cleanEvaluation } from "./evaluation-rules";

describe("PRE-08 — Évaluation après l'évènement (lot 58)", () => {
  it("une note de 1 à 5 obligatoire, trois critères facultatifs de 1 à 5, un commentaire facultatif", () => {
    expect(cleanEvaluation({ rating: 4, punctuality: null, quality: 5, value: null, comment: "  Très pro  " })).toEqual({ rating: 4, punctuality: null, quality: 5, value: null, comment: "Très pro" });
    expect(cleanEvaluation({ rating: 1, punctuality: 1, quality: 1, value: 1, comment: " " }).comment).toBeNull();
    expect(() => cleanEvaluation({ rating: 0, punctuality: null, quality: null, value: null, comment: null })).toThrow();
    expect(() => cleanEvaluation({ rating: 6, punctuality: null, quality: null, value: null, comment: null })).toThrow();
    expect(() => cleanEvaluation({ rating: 3, punctuality: 2.5, quality: null, value: null, comment: null })).toThrow();
    expect(() => cleanEvaluation({ rating: 3, punctuality: null, quality: null, value: null, comment: "x".repeat(2001) })).toThrow();
  });

  it("la moyenne de l'historique, au dixième", () => {
    expect(averageTenths([])).toBeNull();
    expect(averageTenths([4, 5, 4])).toBe(43);
    expect(averageTenths([5])).toBe(50);
  });
});
