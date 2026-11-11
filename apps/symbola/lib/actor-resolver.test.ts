// Lot 23 (partie B ; DAT-06, SEC-19 ; ADR 0060) — dans une requête, l'auteur
// des écritures en base est la personne connectée ; hors requête, « system ».
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookies = vi.fn();
const findSessionActor = vi.fn();
vi.mock("next/headers", () => ({ cookies }));
vi.mock("@symbola/db/client", () => ({ appDatabase: () => ({}) }));
vi.mock("@symbola/auth", () => ({ findSessionActor, isPlannerRole: () => true, requireUser: vi.fn() }));

const { currentActor, withActor } = await import("@symbola/db/actor");
await import("./auth-context");

function sessionCookie(token: string | undefined) {
  cookies.mockResolvedValue({ get: () => (token ? { value: token } : undefined) });
}

describe("SEC-19 — Auteur des écritures d'après la requête", () => {
  beforeEach(() => {
    cookies.mockReset();
    findSessionActor.mockReset();
  });

  it("prend la personne connectée de la requête en cours", async () => {
    sessionCookie("jeton-a");
    findSessionActor.mockResolvedValue({ kind: "member", id: "planner-a" });
    expect(await currentActor()).toEqual({ kind: "member", id: "planner-a" });
  });

  it("relit la session au plus une fois par jeton pendant quelques secondes", async () => {
    sessionCookie("jeton-b");
    findSessionActor.mockResolvedValue({ kind: "member", id: "planner-b" });
    await currentActor();
    await currentActor();
    expect(findSessionActor).toHaveBeenCalledTimes(1);
  });

  it("« system » sans session, ou hors requête", async () => {
    sessionCookie(undefined);
    expect(await currentActor()).toEqual({ kind: "system", id: null });
    cookies.mockRejectedValue(new Error("cookies() hors requête"));
    expect(await currentActor()).toEqual({ kind: "system", id: null });
  });

  it("un auteur déclaré explicitement l'emporte", async () => {
    sessionCookie("jeton-c");
    findSessionActor.mockResolvedValue({ kind: "member", id: "planner-c" });
    expect(await withActor({ kind: "operator", id: null }, () => currentActor())).toEqual({ kind: "operator", id: null });
  });
});
