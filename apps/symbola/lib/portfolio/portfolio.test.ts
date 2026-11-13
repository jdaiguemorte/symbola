// Lot 32b (EVT-07, CRM-04, CHR-03 ; décisions D10 et D11) — calculs du portefeuille, sans écran :
// la charge par mois sur douze mois, les évènements d'un même jour (alerte de date et signalement
// dans la liste), la grille d'un mois pour le calendrier des tâches.
import { describe, expect, it } from "vitest";
import { monthGrid, monthlyLoad, sameDayEvents, sharedDates } from "./portfolio";

const event = (id: string, date: string | null, status: "prospect" | "quote_sent" | "confirmed" | "done" | "lost", isDemo = false) => ({ id, eventDate: date, status, isDemo });

describe("EVT-07 — Charge par mois sur douze mois", () => {
  it("compte, mois par mois, les confirmés et les options (prospect, devis envoyé), sans les perdus ni les essais", () => {
    const load = monthlyLoad(
      [
        event("a", "2027-06-12", "confirmed"),
        event("b", "2027-06-19", "prospect"),
        event("c", "2027-06-26", "quote_sent"),
        event("d", "2027-07-03", "lost"),
        event("e", "2027-07-10", "confirmed", true),
        event("f", null, "prospect"),
        event("g", "2028-06-10", "confirmed"),
      ],
      "2026-11",
    );
    expect(load).toHaveLength(12);
    expect(load[0]).toEqual({ month: "2026-11", confirmed: 0, options: 0 });
    expect(load.find((entry) => entry.month === "2027-06")).toEqual({ month: "2027-06", confirmed: 1, options: 2 });
    expect(load.find((entry) => entry.month === "2027-07")).toEqual({ month: "2027-07", confirmed: 0, options: 0 });
    expect(load.at(-1)!.month).toBe("2027-10");
  });
});

describe("CRM-04 / EVT-07 — Deux évènements le même jour", () => {
  const events = [
    event("lea", "2027-06-12", "confirmed"),
    event("ines", "2027-06-12", "quote_sent"),
    event("chloe", "2027-06-12", "lost"),
    event("demo", "2027-06-12", "prospect", true),
    event("emma", "2027-06-19", "prospect"),
  ];

  it("à la saisie d'une date : les confirmés et les options de ce jour, sans l'évènement lui-même, ni perdus ni essais", () => {
    expect(sameDayEvents(events, "2027-06-12").map((entry) => entry.id)).toEqual(["lea", "ines"]);
    expect(sameDayEvents(events, "2027-06-12", "lea").map((entry) => entry.id)).toEqual(["ines"]);
    expect(sameDayEvents(events, "2027-06-13")).toEqual([]);
    expect(sameDayEvents(events, "pas une date")).toEqual([]);
  });

  it("dans la liste : les dates partagées par deux évènements en cours au moins", () => {
    expect([...sharedDates(events).entries()].map(([date, ids]) => [date, ids])).toEqual([["2027-06-12", ["lea", "ines"]]]);
  });
});

describe("CHR-03 — Grille d'un mois (calendrier des tâches)", () => {
  it("du lundi au dimanche, cases vides avant le premier jour, week-end repéré", () => {
    const grid = monthGrid("2026-11");
    // Le 1er novembre 2026 est un dimanche : six cases vides avant.
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid[6]).toEqual({ date: "2026-11-01", day: 1, weekend: true });
    expect(grid.filter((cell) => cell !== null)).toHaveLength(30);
    expect(grid.at(-1)).toEqual({ date: "2026-11-30", day: 30, weekend: false });
  });

  it("passage à l'heure d'hiver et année bissextile sans décalage", () => {
    expect(monthGrid("2026-10").filter((cell) => cell !== null).map((cell) => cell!.date).slice(24, 27)).toEqual(["2026-10-25", "2026-10-26", "2026-10-27"]);
    expect(monthGrid("2028-02").filter((cell) => cell !== null)).toHaveLength(29);
  });
});
