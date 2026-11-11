// Lot 16 (L16-SEC-02, ADR 0044) — limitation de débit des vraies actions et
// routes, contre un vrai PostgreSQL : seule la requête Next.js (en-têtes,
// cookies, traductions) est simulée, faute de serveur en test.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannerAuthResult } from "./auth-context";

const request = vi.hoisted(() => ({ ip: "203.0.113.1", searchAuth: { status: "unauthenticated" } as PlannerAuthResult }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": request.ip }),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
  getLocale: async () => "fr",
}));
vi.mock("./auth-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth-context")>()),
  getPlannerAuthContext: async () => request.searchAuth,
}));

const { loginAction } = await import("@/app/login/actions");
const { forgotPasswordAction } = await import("@/app/mot-de-passe-oublie/actions");
const { GET: instantSearch } = await import("@/app/recherche/instantanee/route");
const { RATE_LIMITS } = await import("./rate-limit");

// Une adresse propre à chaque test (préfixe de documentation, RFC 5737) :
// seule son empreinte est gardée, elle n'a pas à être routable.
const freshIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}-${randomUUID().slice(0, 8)}`;
const unknownEmail = () => `inconnu-${randomUUID()}@symbola.test`;

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

// Jusqu'à 121 vraies tentatives de suite par test : plus que le délai par défaut.
describe("L16-SEC-02 — Limitation de débit de la connexion, du mot de passe oublié et de la recherche", { timeout: 60_000 }, () => {
  beforeEach(() => {
    request.ip = freshIp();
  });

  it("connexion : au-delà de 20 essais par adresse en 15 minutes, le message dit combien de minutes attendre", async () => {
    for (let attempt = 0; attempt < RATE_LIMITS.login.ip.limit; attempt += 1) {
      expect(await loginAction({}, form({ email: unknownEmail(), password: "mauvais" }))).toEqual({ error: "invalidCredentials" });
    }
    expect(await loginAction({}, form({ email: unknownEmail(), password: "mauvais" }))).toEqual({ error: 'tooMany {"minutes":15}' });
  });

  it("connexion : au-delà de 10 essais sur un même compte, même depuis des adresses différentes", async () => {
    const email = unknownEmail();
    for (let attempt = 0; attempt < RATE_LIMITS.login.account.limit; attempt += 1) {
      request.ip = freshIp();
      expect(await loginAction({}, form({ email, password: "mauvais" }))).toEqual({ error: "invalidCredentials" });
    }
    request.ip = freshIp();
    expect(await loginAction({}, form({ email: email.toUpperCase(), password: "mauvais" }))).toEqual({ error: 'tooMany {"minutes":15}' });
  });

  it("mot de passe oublié : au-delà de 5 demandes par adresse en une heure, plus d'e-mail envoyé et un message", async () => {
    for (let attempt = 0; attempt < RATE_LIMITS.passwordReset.ip.limit; attempt += 1) {
      expect(await forgotPasswordAction({}, form({ email: unknownEmail() }))).toEqual({ sent: true });
    }
    expect(await forgotPasswordAction({}, form({ email: unknownEmail() }))).toEqual({ error: 'tooMany {"minutes":60}' });
  });

  it("recherche instantanée : au-delà de la limite par compte, réponse 429 avec le délai et le message", async () => {
    request.searchAuth = {
      status: "authenticated",
      user: { id: randomUUID(), email: "planner@symbola.test", role: "owner", organizationId: randomUUID(), language: null, firstStepsHidden: false, mfaEnabled: true },
    } as PlannerAuthResult;
    const search = () => instantSearch(new Request("http://localhost:3000/recherche/instantanee?q=mariage"));
    for (let attempt = 0; attempt < RATE_LIMITS.search.account.limit; attempt += 1) expect((await search()).status).toBe(200);
    const refused = await search();
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await refused.json()).toEqual({ error: 'tooMany {"minutes":1}' });
  });
});
