// Lot 34a (EVT-05, ARC-17 ; D3, D4) — règles du cycle de vie, à l'horloge simulée : Jour J le jour
// même dans le fuseau de l'événement (veille, lendemain, heure d'été, fuseau lointain), clôture
// proposée dès le lendemain, statuts posés à la main.
import { describe, expect, it } from "vitest";
import { canPostpone, canSetStatus, closingDue, displayStep, eventPhase, IN_PROGRESS_STATUSES } from "./lifecycle";

const wedding = (status: "confirmed" | "option" | "postponed", timeZone = "Europe/Paris") => ({ status, eventDate: "2027-03-28", timeZone });

describe("EVT-05 — Jour J s'applique de lui-même, dans le fuseau de l'événement (D3)", () => {
  it("la veille, non ; le jour même, oui, dès minuit à Paris ; le lendemain, non", () => {
    expect(eventPhase(wedding("confirmed"), new Date("2027-03-27T22:59:00Z"))).toBe("confirmed");
    // 28 mars 2027 : passage à l'heure d'été à Paris ; minuit y est à 23 h UTC la veille.
    expect(eventPhase(wedding("confirmed"), new Date("2027-03-27T23:00:00Z"))).toBe("day_of");
    expect(eventPhase(wedding("confirmed"), new Date("2027-03-28T21:59:00Z"))).toBe("day_of");
    expect(eventPhase(wedding("confirmed"), new Date("2027-03-28T22:00:00Z"))).toBe("confirmed");
  });

  it("un fuseau lointain compte son propre jour", () => {
    // 27 mars 12 h UTC : déjà le 28 à Auckland, encore le 27 à Paris.
    const now = new Date("2027-03-27T12:00:00Z");
    expect(eventPhase(wedding("confirmed", "Pacific/Auckland"), now)).toBe("day_of");
    expect(eventPhase(wedding("confirmed", "Europe/Paris"), now)).toBe("confirmed");
  });

  it("une option, un report en cours ou un événement sans date ne passent pas en Jour J", () => {
    const day = new Date("2027-03-28T10:00:00Z");
    expect(eventPhase(wedding("option"), day)).toBe("option");
    expect(eventPhase(wedding("postponed"), day)).toBe("postponed");
    expect(eventPhase({ status: "confirmed", eventDate: null, timeZone: "Europe/Paris" }, day)).toBe("confirmed");
  });

  it("la clôture se propose dès le lendemain, jamais le jour même", () => {
    expect(closingDue(wedding("confirmed"), new Date("2027-03-28T21:00:00Z"))).toBe(false);
    expect(closingDue(wedding("confirmed"), new Date("2027-03-28T22:30:00Z"))).toBe(true);
    expect(closingDue(wedding("option"), new Date("2027-04-10T10:00:00Z"))).toBe(false);
  });
});

describe("EVT-05 — Statuts posés à la main, report (D2, D4)", () => {
  it("la frise pose Option, Confirmé, Clôturé ; pas Reporté ni Annulé, qui ont leur geste", () => {
    expect(canSetStatus("option", "confirmed")).toBe(true);
    expect(canSetStatus("confirmed", "closed")).toBe(true);
    expect(canSetStatus("confirmed", "postponed")).toBe(false);
    expect(canSetStatus("confirmed", "cancelled")).toBe(false);
    expect(canSetStatus("confirmed", "confirmed")).toBe(false);
  });

  it("un report en cours se confirme ou s'annule ; une annulation se réactive en Option seulement", () => {
    expect(canSetStatus("postponed", "confirmed")).toBe(false);
    expect(canSetStatus("cancelled", "option")).toBe(true);
    expect(canSetStatus("cancelled", "confirmed")).toBe(false);
  });

  it("seul un événement confirmé se reporte ; les en cours comptent le report", () => {
    expect(canPostpone("confirmed")).toBe(true);
    expect(canPostpone("option")).toBe(false);
    expect(canPostpone("closed")).toBe(false);
    expect(IN_PROGRESS_STATUSES).toEqual(["option", "confirmed", "postponed"]);
  });
});

// Lot 72a (EVT-05 ; E1, J1) : quatre étapes affichées ; « En préparation » n'existe plus en base.
describe("EVT-05 — Les étapes affichées de la frise (lot 72a, J1)", () => {
  it.each([
    ["option", "option", "request"],
    ["confirmed", "confirmed", "signed"],
    ["confirmed", "day_of", "day_of"],
    ["closed", "closed", "closed"],
    ["postponed", "postponed", null],
    ["cancelled", "cancelled", null],
  ] as const)("statut %s, phase %s : étape %s", (status, phase, step) => {
    expect(displayStep(status, phase)).toBe(step);
  });
});
