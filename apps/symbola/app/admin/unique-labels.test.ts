import { describe, expect, it } from "vitest";
import { uniqueLabels } from "./unique-labels";

describe("Lot 9 — noms accessibles distincts pour des organisations homonymes", () => {
  it("numérote les homonymes à partir du deuxième", () => {
    expect(uniqueLabels(["A", "B", "A", "A"])).toEqual(["A", "B", "A (2)", "A (3)"]);
  });
});
