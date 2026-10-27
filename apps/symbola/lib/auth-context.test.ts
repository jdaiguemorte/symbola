import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));

const { toClientAuth, toPlannerAuth } = await import("./auth-context");

const user = (role: "owner" | "member" | "client" | "admin") => ({
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

describe("EVT-06 — Écrans de la planner fermés aux comptes marié", () => {
  it("laisse passer la titulaire et les membres", () => {
    expect(toPlannerAuth(user("owner"))).toEqual(user("owner"));
    expect(toPlannerAuth(user("member"))).toEqual(user("member"));
  });

  it("refuse un compte marié et l'Admin", () => {
    expect(toPlannerAuth(user("client"))).toEqual({ status: "forbidden", role: "client" });
    expect(toPlannerAuth(user("admin"))).toEqual({ status: "forbidden", role: "admin" });
  });

  it("ne change pas une session absente ou en attente de double authentification", () => {
    expect(toPlannerAuth({ status: "unauthenticated" })).toEqual({ status: "unauthenticated" });
    expect(toPlannerAuth({ status: "mfa_required", userId: "u", hasTotpSecret: true })).toEqual({
      status: "mfa_required",
      userId: "u",
      hasTotpSecret: true,
    });
  });
});

describe("EVT-06 — Espace du marié réservé aux comptes marié", () => {
  it("laisse passer un compte marié, refuse la planner et l'Admin", () => {
    expect(toClientAuth(user("client"))).toEqual(user("client"));
    expect(toClientAuth(user("owner"))).toEqual({ status: "forbidden", role: "owner" });
    expect(toClientAuth(user("member"))).toEqual({ status: "forbidden", role: "member" });
    expect(toClientAuth(user("admin"))).toEqual({ status: "forbidden", role: "admin" });
  });
});
