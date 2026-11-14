// Lot 16 (L16-SEC-02, ADR 0044) — limitation de débit des vraies actions et
// routes, contre un vrai PostgreSQL : seule la requête Next.js (en-têtes,
// cookies, traductions) est simulée, faute de serveur en test. Lot 33 : la
// connexion se fait par lien (envoi simulé, compté) ; les échecs de mot de passe
// et leurs délais sont chez le fournisseur d'identité (sa sentinelle).
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlannerAuthResult } from "./auth-context";

const request = vi.hoisted(() => ({ ip: "203.0.113.1", searchAuth: { status: "unauthenticated" } as PlannerAuthResult, linksSent: [] as string[] }));

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
vi.mock("./identity", () => ({
  sendMagicLink: async (email: string) => {
    request.linksSent.push(email);
  },
}));
vi.mock("./auth-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth-context")>()),
  getPlannerAuthContext: async () => request.searchAuth,
}));

const { requestLinkAction } = await import("@/app/login/actions");
const { GET: instantSearch } = await import("@/app/recherche/instantanee/route");
const { checkRateLimit, RATE_LIMITS } = await import("./rate-limit");

// Une adresse propre à chaque test (préfixe de documentation, RFC 5737) :
// seule son empreinte est gardée, elle n'a pas à être routable.
const freshIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}-${randomUUID().slice(0, 8)}`;
const unknownEmail = () => `inconnu-${randomUUID()}@symbola.test`;

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("L16-SEC-02 — Limitation de débit des demandes de lien et de la recherche", { timeout: 60_000 }, () => {
  beforeEach(() => {
    request.ip = freshIp();
    request.linksSent = [];
  });

  it("lien : au-delà de 20 demandes par adresse IP en 15 minutes, la fenêtre refuse et dit combien de minutes attendre", async () => {
    for (let attempt = 0; attempt < RATE_LIMITS.login.ip.limit; attempt += 1) {
      expect(await checkRateLimit("login", { account: unknownEmail() })).toEqual({ allowed: true });
    }
    expect(await checkRateLimit("login", { account: unknownEmail() })).toMatchObject({ allowed: false, retryAfterSeconds: 15 * 60 });
  });

  it("lien : au-delà de 5 demandes pour une même adresse e-mail, même depuis des adresses IP différentes, aucun lien ne part et un message", async () => {
    const email = unknownEmail();
    expect(RATE_LIMITS.login.account.limit).toBe(5);
    for (let attempt = 0; attempt < RATE_LIMITS.login.account.limit; attempt += 1) {
      request.ip = freshIp();
      expect(await requestLinkAction({}, form({ email }))).toEqual({ sent: true });
    }
    request.ip = freshIp();
    expect(await requestLinkAction({}, form({ email: email.toUpperCase() }))).toEqual({ error: 'tooMany {"minutes":15}' });
    expect(request.linksSent).toHaveLength(RATE_LIMITS.login.account.limit);
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

// Lot 24b — SEC-22 : piège à robots des formulaires publics. Un envoi qui
// remplit le champ caché est ignoré, sans compter dans la limitation de débit.
describe("SEC-22 — Piège à robots des formulaires publics", { timeout: 60_000 }, () => {
  beforeEach(() => {
    request.ip = freshIp();
    request.linksSent = [];
  });

  it("demande de lien : un robot reçoit la réponse habituelle, aucun lien ne part et rien ne compte", async () => {
    const email = unknownEmail();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      expect(await requestLinkAction({}, form({ email, site_web: "https://robot.example" }))).toEqual({ sent: true });
    }
    expect(request.linksSent).toEqual([]);
    expect(await requestLinkAction({}, form({ email }))).toEqual({ sent: true });
    expect(request.linksSent).toEqual([email]);
  });

  it("demande de lien : une adresse invalide est refusée sans rien envoyer", async () => {
    expect(await requestLinkAction({}, form({ email: "pas-une-adresse" }))).toEqual({ error: "invalidEmail" });
    expect(request.linksSent).toEqual([]);
  });
});
