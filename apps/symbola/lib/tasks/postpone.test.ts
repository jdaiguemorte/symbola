// Lot 63d (CHR-02) — « Reporter » une tâche, avec une horloge simulée (CLAUDE.md § 6) : veille et jour
// même autour de minuit à Paris, passage à l'heure d'été et à l'heure d'hiver, fin de mois et d'année.
import { describe, expect, it } from "vitest";
import { isPostponeChoice, postponedDueDate } from "./postpone";

describe("CHR-02 — Reporter une tâche depuis sa ligne (lot 63d)", () => {
  it("« demain » et « dans une semaine » se comptent depuis aujourd'hui", () => {
    const now = new Date("2026-11-21T10:00:00Z");
    expect(postponedDueDate("tomorrow", now)).toBe("2026-11-22");
    expect(postponedDueDate("next_week", now)).toBe("2026-11-28");
  });

  it("la veille au soir et le jour même juste après minuit, à l'heure de Paris (pas d'UTC)", () => {
    // 21/11 à 23 h 30 à Paris = 22 h 30 UTC : on est encore le 21.
    expect(postponedDueDate("tomorrow", new Date("2026-11-21T22:30:00Z"))).toBe("2026-11-22");
    // 22/11 à 0 h 30 à Paris = 21/11 à 23 h 30 UTC : on est déjà le 22.
    expect(postponedDueDate("tomorrow", new Date("2026-11-21T23:30:00Z"))).toBe("2026-11-23");
  });

  it("au passage à l'heure d'été (28/03/2027) et à l'heure d'hiver (31/10/2027), un jour reste un jour", () => {
    // 28/03/2027 à 0 h 30 à Paris (heure d'hiver, UTC+1) = 27/03 à 23 h 30 UTC.
    expect(postponedDueDate("tomorrow", new Date("2027-03-27T23:30:00Z"))).toBe("2027-03-29");
    expect(postponedDueDate("next_week", new Date("2027-03-27T23:30:00Z"))).toBe("2027-04-04");
    // 31/10/2027 à 0 h 30 à Paris (heure d'été, UTC+2) = 30/10 à 22 h 30 UTC.
    expect(postponedDueDate("tomorrow", new Date("2027-10-30T22:30:00Z"))).toBe("2027-11-01");
  });

  it("fin de mois et d'année", () => {
    expect(postponedDueDate("tomorrow", new Date("2026-12-31T12:00:00Z"))).toBe("2027-01-01");
    expect(postponedDueDate("next_week", new Date("2027-02-25T12:00:00Z"))).toBe("2027-03-04");
  });

  it("seuls les deux choix du menu sont reconnus", () => {
    expect(isPostponeChoice("tomorrow")).toBe(true);
    expect(isPostponeChoice("next_week")).toBe(true);
    expect(isPostponeChoice("yesterday")).toBe(false);
  });
});
