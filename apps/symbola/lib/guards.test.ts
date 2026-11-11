// Lot 16 (L16-ARC-01, ADR 0043) — gardes d'accès des écrans : comportement de
// chaque garde, et chaque page hors des écrans publics en appelle une.
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
    getClientAuthContext: forbiddenUnless((role) => role === "client"),
  };
});

const { requireAdmin, requireClient, requireOwner, requirePlanner, requireSignedIn } = await import("./guards");

function signedIn(role: string, organizationId: string | null = "org-1"): AuthResult {
  return {
    status: "authenticated",
    user: { id: `user-${role}`, email: `${role}@symbola.test`, role: role as never, organizationId, language: null, firstStepsHidden: false, mfaEnabled: true },
  } as AuthResult;
}

const APP_DIR = fileURLToPath(new URL("../app", import.meta.url));

// Écrans publics : ouverts sans session, chacun protégé autrement (jeton à
// usage unique, état de connexion en cours) ou simple redirection.
const PUBLIC_PAGES: Record<string, string> = {
  "login/page.tsx": "connexion",
  "mfa/page.tsx": "double authentification d'une connexion en cours",
  "mot-de-passe-oublie/page.tsx": "demande de réinitialisation",
  "mot-de-passe/[token]/page.tsx": "jeton de réinitialisation",
  "invitations/[token]/page.tsx": "jeton d'invitation de l'équipe",
  "espace/invitation/[token]/page.tsx": "jeton d'invitation du marié",
  "signature-fictive/[token]/page.tsx": "jeton du signataire (fournisseur fictif, hors production)",
  "import/[importId]/ecarts/page.tsx": "redirection vers l'étape en cours, elle-même gardée",
};

// Accès communs d'une rubrique : ils appellent eux-mêmes une garde.
const SHARED_ACCESS: Record<string, string> = {
  importStepContext: "import/step-context.ts",
  vendorSettingsAccess: "prestataires/parametres/guard.ts",
};

const GUARD_CALL = /\brequire(SignedIn|Planner|Owner|Client|Admin)\(/;

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

  it("requirePlanner envoie à la connexion, à la double authentification, à l'espace du marié ou à l'accueil", async () => {
    await expect(requirePlanner()).rejects.toThrow("redirect:/login");
    auth.current = { status: "mfa_required", userId: "user-owner", role: "owner", totpConfirmed: true };
    await expect(requirePlanner()).rejects.toThrow("redirect:/mfa");
    auth.current = signedIn("client");
    await expect(requirePlanner()).rejects.toThrow("redirect:/espace");
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
    auth.current = signedIn("client");
    await expect(requireOwner()).rejects.toThrow("redirect:/espace");
  });

  it("requireClient réserve l'espace au marié", async () => {
    auth.current = signedIn("owner");
    await expect(requireClient()).rejects.toThrow("redirect:/");
    auth.current = signedIn("client");
    expect((await requireClient()).user.role).toBe("client");
  });

  it("requireAdmin réserve la console à l'Admin", async () => {
    auth.current = signedIn("owner");
    await expect(requireAdmin()).rejects.toThrow("redirect:/");
    auth.current = signedIn("admin", null);
    expect(await requireAdmin()).toEqual({ userId: "user-admin", email: "admin@symbola.test" });
  });

  it("requireSignedIn laisse passer toute personne connectée", async () => {
    await expect(requireSignedIn()).rejects.toThrow("redirect:/login");
    auth.current = signedIn("client");
    expect((await requireSignedIn()).user.role).toBe("client");
  });

  it("chaque page hors des écrans publics appelle une garde", () => {
    const all = pages(APP_DIR);
    const unguarded = all.filter((page) => {
      if (page in PUBLIC_PAGES) return false;
      const source = readFileSync(join(APP_DIR, page), "utf8");
      if (GUARD_CALL.test(source)) return false;
      return !Object.keys(SHARED_ACCESS).some((name) => source.includes(`${name}(`));
    });
    expect(unguarded).toEqual([]);
    // La liste des écrans publics ne garde pas d'adresse disparue.
    expect(Object.keys(PUBLIC_PAGES).filter((page) => !all.includes(page))).toEqual([]);
  });

  it("les accès communs d'une rubrique appellent eux-mêmes une garde", () => {
    for (const file of Object.values(SHARED_ACCESS)) {
      expect(readFileSync(join(APP_DIR, file), "utf8"), file).toMatch(GUARD_CALL);
    }
  });

  it("aucune page ne recopie plus le contrôle de session", () => {
    const copies = pages(APP_DIR).filter((page) => /\bget(Planner|Client)?AuthContext\(\)/.test(readFileSync(join(APP_DIR, page), "utf8")));
    expect(copies).toEqual([]);
  });
});
