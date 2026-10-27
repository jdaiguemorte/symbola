import { describe, expect, it } from "vitest";
import { isPlannerRole, isProfessionalRole } from "./roles";

describe("SOC-04 — Rôles professionnels vs client", () => {
  it.each(["owner", "member", "admin"] as const)(
    "considère %s comme un rôle professionnel (MFA obligatoire)",
    (role) => {
      expect(isProfessionalRole(role)).toBe(true);
    },
  );

  it("ne considère pas le rôle client comme professionnel (MFA facultative)", () => {
    expect(isProfessionalRole("client")).toBe(false);
  });
});

describe("EVT-06 — Rôles admis sur les écrans de la planner", () => {
  it.each(["owner", "member"] as const)("admet %s", (role) => {
    expect(isPlannerRole(role)).toBe(true);
  });

  it.each(["client", "admin"] as const)("refuse %s", (role) => {
    expect(isPlannerRole(role)).toBe(false);
  });
});
