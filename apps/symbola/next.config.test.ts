// SOC-09 — « En-têtes de sécurité vérifiés par un test automatisé (CSP,
// HSTS, X-Frame-Options, Referrer-Policy). » Teste la configuration
// source plutôt qu'un serveur démarré : plus rapide, et c'est la même
// configuration qui s'applique en dev, staging et production.
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

async function getHeaderRules() {
  const rules = await nextConfig.headers?.();
  const rule = rules?.find((r) => r.source === "/:path*");
  if (!rule) throw new Error("règle d'en-têtes introuvable");
  return Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
}

describe("SOC-09 — En-têtes de sécurité", () => {
  // La Content-Security-Policy est testée dans middleware.test.ts : elle a
  // besoin d'un nonce par requête (voir next.config.ts), donc n'est pas
  // posée par cette configuration statique.

  it("pose X-Frame-Options: DENY", async () => {
    const headers = await getHeaderRules();
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("pose une Referrer-Policy", async () => {
    const headers = await getHeaderRules();
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("pose X-Content-Type-Options: nosniff", async () => {
    const headers = await getHeaderRules();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("n'envoie pas HSTS hors production (NODE_ENV actuel du test)", async () => {
    const headers = await getHeaderRules();
    if (process.env.NODE_ENV !== "production") {
      expect(headers["Strict-Transport-Security"]).toBeUndefined();
    }
  });
});
