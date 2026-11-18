// SOC-09 — « En-têtes de sécurité vérifiés par un test automatisé (CSP,
// HSTS, X-Frame-Options, Referrer-Policy). » Teste la configuration
// source plutôt qu'un serveur démarré : plus rapide, et c'est la même
// configuration qui s'applique en dev, staging et production.
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import nextConfig, { CONTACT_FRAME_PAGE, FRAMEABLE_EXCLUDED } from "./next.config";

// Le moteur de correspondance des chemins de Next.js lui-même (sources des règles d'en-têtes).
const { pathToRegexp } = createRequire(import.meta.url)("next/dist/compiled/path-to-regexp") as { pathToRegexp: (path: string) => RegExp };

async function getHeaderRules() {
  const rules = await nextConfig.headers?.();
  const rule = rules?.find((r) => r.source === FRAMEABLE_EXCLUDED);
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

// Lot 16 (L16-SEC-02, ADR 0044).
describe("L16-SEC-02 — Limitation de débit et en-têtes", () => {
  it("pose Permissions-Policy (ni caméra, ni micro, ni géolocalisation) et Cross-Origin-Opener-Policy", async () => {
    const headers = await getHeaderRules();
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("les actions serveur gardent la limite par défaut de Next.js (1 Mo) : les fichiers passent par des routes dédiées", () => {
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBeUndefined();
  });
});

// Lot 44 (CRM-01, D1 ; ADR 0084).
describe("CRM-01 (D1) — Seule la page encadrée du formulaire de contact échappe à X-Frame-Options: DENY", () => {
  // Les en-têtes de toutes les règles qui s'appliquent à un chemin, la dernière l'emportant (Next.js).
  async function headersFor(path: string): Promise<Record<string, string>> {
    const rules = (await nextConfig.headers?.()) ?? [];
    const merged: Record<string, string> = {};
    for (const rule of rules) if (pathToRegexp(rule.source).test(path)) for (const header of rule.headers) merged[header.key] = header.value;
    return merged;
  }

  it("DENY reste sur toute autre page, page publique du formulaire comprise", async () => {
    for (const path of ["/", "/events", "/events/pipeline", "/contact/atelier-camille", "/contact/atelier-camille/cadre/autre", "/parametres"]) {
      expect((await headersFor(path))["X-Frame-Options"]).toBe("DENY");
    }
  });

  it("/contact/<adresse>/cadre n'a pas DENY mais garde les autres en-têtes, et n'est ni indexée ni citée comme référent", async () => {
    const headers = await headersFor("/contact/atelier-camille/cadre");
    expect(headers["X-Frame-Options"]).toBeUndefined();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Robots-Tag"]).toBe("noindex, nofollow, noarchive");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
    expect(CONTACT_FRAME_PAGE).toBe("/contact/:adresse/cadre");
  });
});
