import { describe, expect, it } from "vitest";
import { isAccountingReaderRole, isPlannerRole, isProfessionalRole, requiresMfa, ROLES } from "./roles";

describe("SOC-04 — Rôles professionnels", () => {
  it.each(["owner", "member", "admin"] as const)(
    "considère %s comme un rôle professionnel (MFA obligatoire)",
    (role) => {
      expect(isProfessionalRole(role)).toBe(true);
    },
  );

  it("L26-UX-11 — plus de rôle « client » : les tiers agissent par lien personnel, sans compte (ADR 0053, D8)", () => {
    expect([...ROLES]).toEqual(["owner", "member", "accountant", "admin"]);
  });
});

describe("PRD-EVT-06 — Rôles admis sur les écrans de la planner", () => {
  it.each(["owner", "member"] as const)("admet %s", (role) => {
    expect(isPlannerRole(role)).toBe(true);
  });

  it("refuse admin", () => {
    expect(isPlannerRole("admin")).toBe(false);
  });

  it("refuse le Comptable : il n'a que ses écrans de lecture (lot 52)", () => {
    expect(isPlannerRole("accountant")).toBe(false);
  });
});

describe("HUB-04 (lot 52) — Rôle Comptable, en lecture", () => {
  it("lit la comptabilité, comme la Propriétaire et les Planners ; jamais l'Exploitation", () => {
    expect(isAccountingReaderRole("accountant")).toBe(true);
    expect(isAccountingReaderRole("owner")).toBe(true);
    expect(isAccountingReaderRole("member")).toBe(true);
    expect(isAccountingReaderRole("admin")).toBe(false);
  });
});

describe("SEC-02 (lot 52, D5) — Double authentification exigée ou proposée", () => {
  it("exigée pour la Propriétaire, l'Exploitation et le Comptable", () => {
    expect(requiresMfa("owner")).toBe(true);
    expect(requiresMfa("admin")).toBe(true);
    expect(requiresMfa("accountant")).toBe(true);
  });

  it("proposée seulement aux Planners", () => {
    expect(requiresMfa("member")).toBe(false);
  });
});
