// Lot 70a (CHR-03 ; § 3.3) — périodes de la liste des tâches en fonctions pures : cette semaine (lundi à
// dimanche), les quinze prochains jours retards compris, ce mois-ci, entre deux dates ; cas limites
// (dimanche, fin de mois, année bissextile, dates inversées).
import { describe, expect, it } from "vitest";
import { periodRange } from "./task-filters";

describe("CHR-03 — Périodes de la liste des tâches", () => {
  it("en retard : avant aujourd'hui", () => {
    expect(periodRange({ kind: "late" }, "2027-03-10")).toEqual({ from: null, to: "2027-03-09" });
  });

  it("cette semaine : du lundi au dimanche, y compris un dimanche et un lundi", () => {
    expect(periodRange({ kind: "week" }, "2027-03-10")).toEqual({ from: "2027-03-08", to: "2027-03-14" });
    expect(periodRange({ kind: "week" }, "2027-03-14")).toEqual({ from: "2027-03-08", to: "2027-03-14" });
    expect(periodRange({ kind: "week" }, "2027-03-15")).toEqual({ from: "2027-03-15", to: "2027-03-21" });
  });

  it("les quinze prochains jours, retards compris", () => {
    expect(periodRange({ kind: "fortnight" }, "2027-03-10")).toEqual({ from: null, to: "2027-03-24" });
  });

  it("ce mois-ci, fin de février d'une année bissextile comprise", () => {
    expect(periodRange({ kind: "month" }, "2028-02-10")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(periodRange({ kind: "month" }, "2027-12-31")).toEqual({ from: "2027-12-01", to: "2027-12-31" });
  });

  it("entre deux dates comprises ; inversées ou mal formées, refusées", () => {
    expect(periodRange({ kind: "between", from: "2027-04-01", to: "2027-04-30" }, "2027-03-10")).toEqual({ from: "2027-04-01", to: "2027-04-30" });
    expect(() => periodRange({ kind: "between", from: "2027-05-01", to: "2027-04-01" }, "2027-03-10")).toThrow(RangeError);
    expect(() => periodRange({ kind: "between", from: "01/04/2027", to: "2027-04-30" }, "2027-03-10")).toThrow(RangeError);
  });
});
