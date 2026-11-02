import { describe, expect, it } from "vitest";
import { sameImportValue } from "./compare";

describe("IMP-05 — Comparaison des valeurs importées", () => {
  it("ignore l'ordre des clés, y compris dans les listes d'objets", () => {
    expect(sameImportValue([{ firstName: "A", lastName: "B" }], [{ lastName: "B", firstName: "A" }])).toBe(true);
    expect(sameImportValue({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
  });

  it("null et absent se valent ; une valeur différente ne vaut pas", () => {
    expect(sameImportValue(null, undefined)).toBe(true);
    expect(sameImportValue({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameImportValue([1, 2], [2, 1])).toBe(false);
  });
});
