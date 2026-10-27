import { describe, expect, it } from "vitest";
import { formatDecimal, parseDecimal } from "./decimal-input";

describe("DEV-01 — Saisie des montants et quantités sans virgule flottante", () => {
  it("lit les montants en centimes, virgule ou point, espaces de milliers acceptés", () => {
    expect(parseDecimal("1500", 2)).toBe(150000);
    expect(parseDecimal("1 234,56", 2)).toBe(123456);
    expect(parseDecimal("0.1", 2)).toBe(10);
    expect(parseDecimal("19,99", 2)).toBe(1999);
  });

  it("lit les quantités en millièmes", () => {
    expect(parseDecimal("1,5", 3)).toBe(1500);
    expect(parseDecimal("12", 3)).toBe(12000);
  });

  it("refuse le vide, le négatif, le texte et trop de décimales plutôt que d'arrondir", () => {
    expect(parseDecimal("", 2)).toBeNull();
    expect(parseDecimal("-5", 2)).toBeNull();
    expect(parseDecimal("douze", 2)).toBeNull();
    expect(parseDecimal("1,234", 2)).toBeNull();
    expect(parseDecimal("1e5", 2)).toBeNull();
  });

  it("réaffiche une valeur dans la langue de la planner", () => {
    expect(formatDecimal(150000, 2, "fr")).toBe("1500");
    expect(formatDecimal(1999, 2, "fr")).toBe("19,99");
    expect(formatDecimal(1500, 3, "en")).toBe("1.5");
    expect(formatDecimal(5, 2, "fr")).toBe("0,05");
  });
});
