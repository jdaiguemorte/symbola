import { describe, expect, it } from "vitest";
import { dayDistance, dayPhrase } from "./search-day";

describe("HUB-12 — la recherche dit où mène chaque résultat : « dans 6 jours » (lot 70e, M9)", () => {
  it("compte les jours entre deux dates sans heure, passage à l'heure d'été compris", () => {
    expect(dayDistance("2027-03-20", "2027-03-28")).toBe(8);
    expect(dayDistance("2027-03-28", "2027-03-28")).toBe(0);
    expect(dayDistance("2027-03-30", "2027-03-28")).toBe(-2);
  });

  it("dit aujourd'hui, demain, dans n jours, il y a n jours", () => {
    expect(dayPhrase(0)).toEqual({ kind: "today" });
    expect(dayPhrase(1)).toEqual({ kind: "tomorrow" });
    expect(dayPhrase(6)).toEqual({ kind: "future", days: 6 });
    expect(dayPhrase(-1)).toEqual({ kind: "yesterday" });
    expect(dayPhrase(-4)).toEqual({ kind: "past", days: 4 });
  });
});
