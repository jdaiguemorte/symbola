// Lot 23 (SEC-19, ADR 0060) — le catalogue des actions (@symbola/contracts)
// et les contraintes de la table (schema/core.ts) disent la même chose.
import { AUDIT_ACTIONS, AUDIT_ACTOR_KINDS, AUDIT_CATEGORIES, isDeletionAction } from "@symbola/contracts";
import { describe, expect, it } from "vitest";
import { AUDIT_ACTOR_KINDS as TABLE_ACTOR_KINDS, AUDIT_CATEGORIES as TABLE_CATEGORIES } from "./schema/core";

describe("SEC-19 — Catalogue des actions du journal d'audit", () => {
  it("les familles et les auteurs du catalogue sont ceux de la table", () => {
    expect([...AUDIT_CATEGORIES]).toEqual([...TABLE_CATEGORIES]);
    expect([...AUDIT_ACTOR_KINDS]).toEqual([...TABLE_ACTOR_KINDS]);
  });

  it("chaque action se nomme <module>.<objet>.<action> et n'imite pas une suppression de ligne", () => {
    for (const action of Object.keys(AUDIT_ACTIONS)) {
      expect(action, action).toMatch(/^(hub|events|budget|quotes|vendors|ops)\.[a-z_]+\.[a-z_]+$/);
      expect(isDeletionAction(action), action).toBe(false);
    }
  });

  it("couvre chaque famille de SEC-19 (connexions, droits, exports, partages, émissions, encaissements, suppressions) et l'exploitation", () => {
    const covered = new Set(Object.values(AUDIT_ACTIONS).map((spec) => spec.category));
    for (const category of ["connexion", "droits", "export", "partage", "emission", "encaissement", "suppression", "exploitation"]) {
      expect(covered.has(category as never), category).toBe(true);
    }
  });
});
