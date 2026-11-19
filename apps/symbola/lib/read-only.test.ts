// Lot 54 (HUB-27, D2 ; ADR 0101) — fin de l'essai : l'espace en lecture seule lit tout et exporte,
// mais toute écriture est refusée, sauf l'abonnement, l'export et la fermeture.
import { describe, expect, it } from "vitest";
import type { AuthResult } from "@symbola/auth";
import { applyReadOnly, isWriteMethod, READ_ONLY_ROLE } from "./read-only";

function signedIn(organizationId: string | null = "org-1"): AuthResult {
  return {
    status: "authenticated",
    user: { id: "user-1", email: "planner@symbola.test", role: "owner", organizationId, language: null, firstStepsHidden: false, mfaEnabled: true },
  } as AuthResult;
}

const readOnly = (ids: string[]) => async (organizationId: string) => ids.includes(organizationId);

describe("HUB-27 — Fin d'essai en lecture seule, export possible", () => {
  it("seules les requêtes autres que GET et HEAD sont des écritures ; sans méthode connue, rien n'est refusé", () => {
    expect(isWriteMethod("POST")).toBe(true);
    expect(isWriteMethod("DELETE")).toBe(true);
    expect(isWriteMethod("GET")).toBe(false);
    expect(isWriteMethod("HEAD")).toBe(false);
    expect(isWriteMethod(null)).toBe(false);
  });

  it("une écriture d'un espace en lecture seule est refusée ; sa lecture passe", async () => {
    expect(await applyReadOnly(signedIn(), {}, "POST", readOnly(["org-1"]))).toEqual({ status: "forbidden", role: READ_ONLY_ROLE });
    expect((await applyReadOnly(signedIn(), {}, "GET", readOnly(["org-1"]))).status).toBe("authenticated");
  });

  it("l'abonnement, l'export et la fermeture restent permis (allowReadOnly)", async () => {
    expect((await applyReadOnly(signedIn(), { allowReadOnly: true }, "POST", readOnly(["org-1"]))).status).toBe("authenticated");
  });

  it("un espace actif écrit comme avant ; un autre espace en lecture seule ne change rien (isolation)", async () => {
    expect((await applyReadOnly(signedIn("org-2"), {}, "POST", readOnly(["org-1"]))).status).toBe("authenticated");
  });

  it("un refus déjà décidé (session absente, rôle interdit) reste tel quel", async () => {
    expect(await applyReadOnly({ status: "unauthenticated" }, {}, "POST", readOnly(["org-1"]))).toEqual({ status: "unauthenticated" });
    expect(await applyReadOnly({ status: "forbidden", role: "admin" }, {}, "POST", readOnly(["org-1"]))).toEqual({ status: "forbidden", role: "admin" });
  });
});
