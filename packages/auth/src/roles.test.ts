import { describe, expect, it } from "vitest";
import { isProfessionalRole } from "./roles";

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
