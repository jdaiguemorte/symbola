// Lot 16 (L16-ARC-01, ADR 0043) — gardes d'accès des écrans : comportement de
// chaque garde. Que chaque page, route et action en appelle une : lot 24a,
// lib/access-rules.test.ts (SEC-12).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthResult } from "@symbola/auth";

const auth = vi.hoisted(() => ({ current: { status: "unauthenticated" } as AuthResult }));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("./auth-context", async () => {
  const { isPlannerRole } = await import("@symbola/auth");
  const forbiddenUnless = (allowed: (role: string) => boolean) => async () => {
    const result = auth.current;
    if (result.status !== "authenticated") return result;
    return allowed(result.user.role) ? result : { status: "forbidden", role: result.user.role };
  };
  return {
    getAuthContext: async () => auth.current,
    getPlannerAuthContext: forbiddenUnless((role) => isPlannerRole(role as never)),
  };
});

// Lot 26a : la session d'un lien personnel, lue par requireLink.
const link = vi.hoisted(() => ({ current: null as null | { organizationId: string; linkId: string; eventId: string } }));
vi.mock("./link-session", () => ({ currentLinkAccess: async () => link.current }));

const { requireOperator, requireLink, requireOwner, requirePlanner, requireSignedIn } = await import("./guards");

function signedIn(role: string, organizationId: string | null = "org-1"): AuthResult {
  return {
    status: "authenticated",
    user: { id: `user-${role}`, email: `${role}@symbola.test`, role: role as never, organizationId, language: null, firstStepsHidden: false, mfaEnabled: true },
  } as AuthResult;
}

const APP_DIR = fileURLToPath(new URL("../app", import.meta.url));

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return pages(path);
    return entry === "page.tsx" ? [relative(APP_DIR, path)] : [];
  });
}

describe("L16-ARC-01 — Une garde d'accès unique", () => {
  beforeEach(() => {
    auth.current = { status: "unauthenticated" };
  });

  it("requirePlanner envoie à la connexion, à la double authentification ou à l'accueil", async () => {
    await expect(requirePlanner()).rejects.toThrow("redirect:/login");
    auth.current = { status: "mfa_required", userId: "user-owner", role: "owner" };
    await expect(requirePlanner()).rejects.toThrow("redirect:/securite");
    auth.current = signedIn("admin", null);
    await expect(requirePlanner()).rejects.toThrow("redirect:/");
    auth.current = signedIn("member", null);
    await expect(requirePlanner()).rejects.toThrow("redirect:/");
  });

  it("requirePlanner renvoie la planner et son organisation", async () => {
    auth.current = signedIn("member");
    const planner = await requirePlanner();
    expect(planner.user).toMatchObject({ id: "user-member", role: "member", organizationId: "org-1" });
  });

  it("requireOwner renvoie la titulaire, et null pour un collaborateur", async () => {
    auth.current = signedIn("owner");
    expect((await requireOwner())?.user.role).toBe("owner");
    auth.current = signedIn("member");
    expect(await requireOwner()).toBeNull();
    auth.current = signedIn("admin", null);
    await expect(requireOwner()).rejects.toThrow("redirect:/");
  });

  it("L26-SEC-14 — requireLink ouvre le portail à une session de lien, jamais à une session de compte", async () => {
    auth.current = signedIn("owner");
    await expect(requireLink()).rejects.toThrow("redirect:/lien");
    link.current = { organizationId: "org-1", linkId: "link-1", eventId: "event-1" };
    expect(await requireLink()).toMatchObject({ linkId: "link-1", eventId: "event-1" });
    link.current = null;
  });

  it("requireOperator réserve la console à l'Admin", async () => {
    auth.current = signedIn("owner");
    await expect(requireOperator()).rejects.toThrow("redirect:/");
    auth.current = signedIn("admin", null);
    expect(await requireOperator()).toEqual({ userId: "user-admin", email: "admin@symbola.test" });
  });

  it("requireSignedIn laisse passer toute personne connectée", async () => {
    await expect(requireSignedIn()).rejects.toThrow("redirect:/login");
    auth.current = signedIn("member");
    expect((await requireSignedIn()).user.role).toBe("member");
  });

  it("aucune page ne recopie plus le contrôle de session", () => {
    const copies = pages(APP_DIR).filter((page) => /\bget(Planner|Client)?AuthContext\(\)/.test(readFileSync(join(APP_DIR, page), "utf8")));
    expect(copies).toEqual([]);
  });
});
