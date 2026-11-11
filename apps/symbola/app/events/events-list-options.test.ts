import { describe, expect, it } from "vitest";
import { parseYear, tabCounts, yearOptions } from "./events-list-options";

describe("L13-EVT-18 — Liste des événements : filtres", () => {
  it("propose les années des événements, plus l'année en cours et la suivante, de la plus récente à la plus ancienne", () => {
    expect(yearOptions(["2025-06-14", null, "2028-09-02", "2025-07-01"], "2026-11-06")).toEqual([2028, 2027, 2026, 2025]);
  });

  it("sans événement daté, propose l'année en cours et la suivante, jamais 1 ni −1", () => {
    expect(yearOptions([], "2026-11-06")).toEqual([2027, 2026]);
  });

  it("ignore une année absente des options", () => {
    const options = [2027, 2026];
    expect(parseYear("1", options)).toBeUndefined();
    expect(parseYear("-1", options)).toBeUndefined();
    expect(parseYear("2026", options)).toBe(2026);
    expect(parseYear(undefined, options)).toBeUndefined();
  });

  it("compte les événements à venir et terminés", () => {
    expect(tabCounts(["prospect", "confirmed", "done", "lost", "quote_sent"])).toEqual({ upcoming: 3, past: 2 });
  });
});
