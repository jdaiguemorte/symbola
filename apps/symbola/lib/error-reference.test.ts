// Lot 39b (NFR-16 ; D9 ; ADR 0074) — la référence d'une erreur : courte, dictable, la même à l'écran
// et au journal pour une même erreur.
import { describe, expect, it } from "vitest";
import { ERROR_REFERENCE, errorReference, newErrorReference } from "./error-reference";

describe("NFR-16 — Une référence d'erreur retrouvable dans les journaux", () => {
  it("huit caractères sans lettre ambiguë, en deux groupes", () => {
    expect(errorReference("3830109604")).toMatch(ERROR_REFERENCE);
    expect(newErrorReference()).toMatch(ERROR_REFERENCE);
    expect(errorReference("3830109604")).not.toMatch(/[ILOU]/);
  });

  it("la même erreur donne la même référence ; deux erreurs, deux références", () => {
    expect(errorReference("3830109604")).toBe(errorReference("3830109604"));
    expect(errorReference("3830109604")).not.toBe(errorReference("3830109605"));
  });
});
