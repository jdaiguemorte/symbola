import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { toPlannerAuth } = await import("./auth-context");

const user = (role: "owner" | "member" | "admin") => ({
  status: "authenticated" as const,
  user: {
    id: "u",
    email: "x@example.test",
    role,
    organizationId: role === "admin" ? null : "o",
    language: null,
    firstStepsHidden: false,
    mfaEnabled: false,
  },
});

describe("PRD-EVT-06 — Écrans de la planner fermés aux autres rôles", () => {
  it("laisse passer la titulaire et les membres", () => {
    expect(toPlannerAuth(user("owner"))).toEqual(user("owner"));
    expect(toPlannerAuth(user("member"))).toEqual(user("member"));
  });

  it("refuse l'Admin (lot 26a : les mariés n'ont plus de compte)", () => {
    expect(toPlannerAuth(user("admin"))).toEqual({ status: "forbidden", role: "admin" });
  });

  it("ne change pas une session absente ou en attente de double authentification", () => {
    expect(toPlannerAuth({ status: "unauthenticated" })).toEqual({ status: "unauthenticated" });
    expect(toPlannerAuth({ status: "mfa_required", userId: "u", role: "owner" })).toEqual({
      status: "mfa_required",
      userId: "u",
      role: "owner",
    });
  });
});
