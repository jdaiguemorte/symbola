// Lot 60 (L60-PLA-05, POR-10) — la rubrique « Plan de salle » : fermée par défaut, ouverte lien par
// lien, et seulement à un lien du client (le prestataire passe par son statut retenu).
import { describe, expect, it } from "vitest";
import type { EventLinkRights, LinkRubric } from "@symbola/contracts";
import { floorplanRubricOpen } from "./link-access";

const rights = (rubrics: LinkRubric[]): EventLinkRights => ({ rubrics, budgetScope: "all", sharedSlotIds: [] });

describe("L60-PLA-05 — Rubrique « Plan de salle » du portail, fermée par défaut", () => {
  it("ouverte seulement si la planner l'a cochée sur un lien du client", () => {
    expect(floorplanRubricOpen({ audience: "client", rights: rights([]) })).toBe(false);
    expect(floorplanRubricOpen({ audience: "client", rights: rights(["program", "guests"]) })).toBe(false);
    expect(floorplanRubricOpen({ audience: "client", rights: rights(["floorplan"]) })).toBe(true);
    expect(floorplanRubricOpen({ audience: "vendor", rights: rights(["floorplan"]) })).toBe(false);
  });
});
