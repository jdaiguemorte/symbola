import { describe, expect, it } from "vitest";
import { dateShortcuts, isDateShortcut, shortcutDate } from "./date-shortcuts";

describe("CHR-02, UX-07 — « Changer la date » : les raccourcis (lot 70c)", () => {
  it("depuis un mercredi : demain jeudi, lundi prochain, dans une semaine (maquette du 25/11)", () => {
    expect(dateShortcuts("2026-11-25")).toEqual({ tomorrow: "2026-11-26", next_monday: "2026-11-30", in_a_week: "2026-12-02" });
  });

  it("un lundi, « Lundi prochain » est celui de la semaine suivante", () => {
    expect(shortcutDate("next_monday", "2026-11-30")).toBe("2026-12-07");
  });

  it("un dimanche, « Lundi prochain » est le lendemain", () => {
    expect(shortcutDate("next_monday", "2026-11-29")).toBe("2026-11-30");
  });

  it("fin de mois et passage à l'heure d'été : les jours se comptent en dates, sans décalage", () => {
    expect(shortcutDate("tomorrow", "2027-03-27")).toBe("2027-03-28");
    expect(shortcutDate("tomorrow", "2027-03-28")).toBe("2027-03-29");
    expect(shortcutDate("in_a_week", "2027-03-25")).toBe("2027-04-01");
    expect(shortcutDate("tomorrow", "2026-12-31")).toBe("2027-01-01");
  });

  it("refuse un raccourci inconnu", () => {
    expect(isDateShortcut("tomorrow")).toBe(true);
    expect(isDateShortcut("next_week")).toBe(false);
  });
});
