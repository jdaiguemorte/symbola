import { describe, expect, it } from "vitest";
import { informationRows, progressFacts, type InformationInput } from "./overview-info";

const full: InformationInput = {
  clients: ["Léa Martin", "Maxime Roux"],
  guests: { estimated: 120, confirmed: null, answered: null },
  places: ["Manoir des Aulnes (14:30)"],
  wantedBudgetCents: 4_000_000,
  style: "Champêtre",
  type: "Mariage",
  source: "Salon du mariage",
  busy: "Bloqué pour l'équipe du ven. 11 au dim. 13 juin",
  team: { members: ["Camille (planner principale)", "Bastien"], soloPlanner: false },
  notes: { kind: "text", text: "Allergie aux fruits à coque" },
};

describe("EVT-03 — « Informations » de la Synthèse (lot 72e ; C-28, P-09)", () => {
  it("dix lignes dans l'ordre de la maquette 16, chacune avec sa rubrique de « Modifier les informations »", () => {
    expect(informationRows(full).map((row) => [row.key, row.rubric])).toEqual([
      ["clients", "clients"],
      ["guests", "guests"],
      ["places", "dates"],
      ["wantedBudget", "guests"],
      ["style", "style"],
      ["type", "origin"],
      ["source", "origin"],
      ["busy", "dates"],
      ["team", null],
      ["notes", "style"],
    ]);
    expect(informationRows(full).every((row) => !row.missing)).toBe(true);
  });
  it("une valeur absente dit « non renseigné » et mène à sa rubrique (jamais un « — » muet)", () => {
    const rows = informationRows({ ...full, guests: { estimated: null, confirmed: null, answered: null }, wantedBudgetCents: null, style: null, source: null, places: [], notes: { kind: "text", text: null } });
    expect(rows.filter((row) => row.missing).map((row) => row.key)).toEqual(["guests", "places", "wantedBudget", "style", "source", "notes"]);
  });
  it("l'équipe est masquée pour une planner seule ; jamais « Planner principal : Aucun »", () => {
    expect(informationRows({ ...full, team: { members: [], soloPlanner: true } }).some((row) => row.key === "team")).toBe(false);
    const nobody = informationRows({ ...full, team: { members: [], soloPlanner: false } }).find((row) => row.key === "team");
    expect(nobody).toMatchObject({ missing: true });
  });
  it("des notes confidentielles que la personne ne lit pas ne sont pas dites absentes", () => {
    expect(informationRows({ ...full, notes: { kind: "hidden" } }).find((row) => row.key === "notes")).toMatchObject({ missing: false });
  });
  it("sans module de la plage occupée lue (pas de date), l'agenda dit quoi faire", () => {
    expect(informationRows({ ...full, busy: null }).find((row) => row.key === "busy")).toMatchObject({ missing: true });
  });
});

describe("EVT-02 — « Où en est le mariage » ne dit complet que ce qui l'est (lot 72e ; P-05, C-55)", () => {
  it("zéro tâche : pas d'avis, jamais « 0 sur 0 » ni « Bon »", () => {
    expect(progressFacts({ tasks: { done: 0, total: 0, late: 0 }, vendors: { complete: 0, total: 9, contractsAwaited: 0 }, decisions: { pending: 0, since: null } }).tasks).toEqual({ kind: "none" });
  });
  it("tâches, postes et décisions en nombres qui se recomptent", () => {
    expect(progressFacts({ tasks: { done: 14, total: 20, late: 2 }, vendors: { complete: 6, total: 9, contractsAwaited: 1 }, decisions: { pending: 1, since: "2026-11-18" } })).toEqual({
      tasks: { kind: "count", done: 14, total: 20, late: 2 },
      vendors: { kind: "count", complete: 6, total: 9, contractsAwaited: 1 },
      decisions: { kind: "pending", count: 1, since: "2026-11-18" },
    });
  });
  it("aucun poste requis : rien à compter ; aucune décision en attente : « aucune »", () => {
    const facts = progressFacts({ tasks: { done: 1, total: 1, late: 0 }, vendors: { complete: 0, total: 0, contractsAwaited: 0 }, decisions: { pending: 0, since: null } });
    expect(facts.vendors).toEqual({ kind: "none" });
    expect(facts.decisions).toEqual({ kind: "none" });
  });
});
