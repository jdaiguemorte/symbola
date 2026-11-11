// SOC-09 — « CSP vérifiée par un test automatisé. » La CSP est posée par
// requête (nonce) plutôt que par next.config.ts : voir middleware.ts pour
// le contexte (écran blanc constaté au premier déploiement réel).
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { middleware } from "./middleware";

function callMiddleware() {
  const request = new NextRequest("https://staging.symbola.fr/login");
  return middleware(request);
}

describe("SOC-09 — Content-Security-Policy (middleware, nonce par requête)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("pose une CSP stricte avec un script-src restreint au nonce", async () => {
    const response = await callMiddleware();
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it("génère un nonce différent à chaque requête", async () => {
    const [first, second] = await Promise.all([callMiddleware(), callMiddleware()]);
    const nonceOf = (response: Awaited<ReturnType<typeof callMiddleware>>) =>
      response.headers.get("Content-Security-Policy")?.match(/nonce-([^']+)/)?.[1];
    expect(nonceOf(first)).toBeTruthy();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
  });

  it("transmet le nonce à la requête interne (x-nonce) pour que Next.js l'applique à ses propres scripts", async () => {
    const response = await callMiddleware();
    const csp = response.headers.get("Content-Security-Policy");
    const nonceFromCsp = csp?.match(/nonce-([^']+)/)?.[1];
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonceFromCsp);
  });

  // AIDE-01 : 'unsafe-eval' n'est nécessaire qu'au Fast Refresh du serveur
  // de dev (voir middleware.ts) — jamais envoyé aux utilisateurs réels.
  it("n'autorise jamais 'unsafe-eval' en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const csp = (await callMiddleware()).headers.get("Content-Security-Policy");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("autorise 'unsafe-eval' hors production (Fast Refresh du serveur de dev)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const csp = (await callMiddleware()).headers.get("Content-Security-Policy");
    expect(csp).toContain("'unsafe-eval'");
  });
});

// Lot 24b — SEC-05 : cookie de session inaccessible aux scripts, limité au site
// et au HTTPS, expiré après 8 heures sans activité.
describe("SEC-05 — Cookie de session HttpOnly, Secure, SameSite, expiré à l'inactivité", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function navigate(method: "GET" | "POST", cookie?: string) {
    return middleware(new NextRequest("https://symbola.fr/events", { method, headers: cookie ? { cookie } : {} }));
  }

  it("chaque navigation prolonge le cookie de 8 heures, avec HttpOnly, SameSite=Lax et Secure en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const setCookie = (await navigate("GET", "symbola_session=jeton-de-session")).headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("symbola_session=jeton-de-session");
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    expect(setCookie).toMatch(/Max-Age=28800/);
    expect(setCookie).toMatch(/Path=\//);
  });

  it("ne touche pas au cookie sans session, ni lors d'un envoi de formulaire (la déconnexion l'efface)", async () => {
    expect((await navigate("GET")).headers.get("set-cookie") ?? "").not.toContain("symbola_session");
    expect((await navigate("POST", "symbola_session=jeton-de-session")).headers.get("set-cookie") ?? "").not.toContain("symbola_session");
  });
});

