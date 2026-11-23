// NFR-02 (ADR 0115) — une lecture faite une fois par affichage, jamais mise en commun pour une action
// serveur ni hors d'une requête.
import { beforeEach, describe, expect, it, vi } from "vitest";

const method = vi.hoisted(() => ({ current: null as string | null }));
vi.mock("./request-method", () => ({ requestMethod: async () => method.current }));
// cache() de React ne garde rien hors d'un rendu serveur : ici, un cache par argument, comme pendant
// une requête d'affichage.
vi.mock("react", () => ({
  cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
    const seen = new Map<string, R>();
    return (...args: A) => {
      const key = JSON.stringify(args);
      if (!seen.has(key)) seen.set(key, fn(...args));
      return seen.get(key)!;
    };
  },
}));

const { memoizePerRequest } = await import("./request-memo");

describe("NFR-02 — Une lecture par affichage", () => {
  beforeEach(() => {
    method.current = null;
  });

  it("à l'affichage (GET), la même lecture n'est faite qu'une fois par argument", async () => {
    method.current = "GET";
    const read = vi.fn(async (id: string) => `ligne ${id}`);
    const once = memoizePerRequest(read);
    expect(await once("a")).toBe("ligne a");
    expect(await once("a")).toBe("ligne a");
    expect(await once("b")).toBe("ligne b");
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("une action serveur (POST) relit à chaque appel : elle peut avoir changé ce qu'elle relit", async () => {
    method.current = "POST";
    const read = vi.fn(async () => "session");
    const once = memoizePerRequest(read);
    await once();
    await once();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("hors d'une requête (tâche de fond, test), aucune mise en commun", async () => {
    const read = vi.fn(async () => "modules");
    const once = memoizePerRequest(read);
    await once();
    await once();
    expect(read).toHaveBeenCalledTimes(2);
  });
});
