// Lot 49 (INV-02, POR-10 ; D5) — la rubrique « Invités » du portail n'est ouverte qu'au lien du
// client à qui la planner l'a ouverte (rien par défaut).
import { describe, expect, it } from "vitest";
import { guestsRubricOpen } from "./access";

const rights = (rubrics: ("tasks" | "guests")[]) => ({ rubrics, budgetScope: "all" as const, sharedSlotIds: [] });

describe("INV-02 — Le client importe et saisit depuis son portail seulement si la rubrique lui est ouverte", () => {
  it("fermée par défaut, ouverte lien par lien, jamais à un prestataire", () => {
    expect(guestsRubricOpen({ audience: "client", rights: rights([]) })).toBe(false);
    expect(guestsRubricOpen({ audience: "client", rights: rights(["tasks"]) })).toBe(false);
    expect(guestsRubricOpen({ audience: "client", rights: rights(["guests"]) })).toBe(true);
    expect(guestsRubricOpen({ audience: "vendor", rights: rights(["guests"]) })).toBe(false);
  });
});
