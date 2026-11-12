import { describe, expect, it } from "vitest";
import { isPlannerRole, isProfessionalRole, ROLES } from "./roles";

describe("SOC-04 — Rôles professionnels", () => {
  it.each(["owner", "member", "admin"] as const)(
    "considère %s comme un rôle professionnel (MFA obligatoire)",
    (role) => {
      expect(isProfessionalRole(role)).toBe(true);
    },
  );

  it("L26-UX-11 — plus de rôle « client » : les tiers agissent par lien personnel, sans compte (ADR 0053, D8)", () => {
    expect([...ROLES]).toEqual(["owner", "member", "admin"]);
  });
});

describe("PRD-EVT-06 — Rôles admis sur les écrans de la planner", () => {
  it.each(["owner", "member"] as const)("admet %s", (role) => {
    expect(isPlannerRole(role)).toBe(true);
  });

  it("refuse admin", () => {
    expect(isPlannerRole("admin")).toBe(false);
  });
});
