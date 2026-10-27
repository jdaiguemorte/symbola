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
