// SOC-09, CRM-01 (lot 44, D1) — la politique de sécurité du contenu : jamais d'encadrement, sauf la
// page encadrée du formulaire de contact, et seulement par les sites déclarés.
import { describe, expect, it } from "vitest";
import { contactFrameSlug, contentSecurityPolicy, frameAncestors } from "./csp";

describe("SOC-09 — Content-Security-Policy par nonce", () => {
  it("scripts par nonce, eval seulement hors production, aucun objet", () => {
    const production = contentSecurityPolicy({ nonce: "abc", production: true });
    expect(production).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(production).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy({ nonce: "abc", production: false })).toContain("'unsafe-eval'");
    expect(production).toContain("object-src 'none'");
  });
});

describe("CRM-01 (D1) — frame-ancestors de la seule page encadrée", () => {
  it("par défaut, aucune page ne peut être encadrée", () => {
    expect(contentSecurityPolicy({ nonce: "n", production: true })).toContain("frame-ancestors 'none'");
    expect(frameAncestors(null)).toBe("'none'");
  });

  it("la page encadrée d'un formulaire ouvert accepte Symbola (aperçu) et les seuls sites déclarés, jamais une valeur qui casserait la directive", () => {
    expect(contentSecurityPolicy({ nonce: "n", production: true, frameAncestors: ["https://www.atelier.test", "https://atelier.test"] })).toContain("frame-ancestors 'self' https://www.atelier.test https://atelier.test;");
    expect(frameAncestors(["http://atelier.test", "https://*.pirate.test", "https://a.test; script-src *", "*"])).toBe("'self'");
    expect(frameAncestors([])).toBe("'self'");
  });

  it("seule /contact/<adresse>/cadre est la page encadrée", () => {
    expect(contactFrameSlug("/contact/atelier-camille/cadre")).toBe("atelier-camille");
    expect(contactFrameSlug("/contact/atelier-camille/cadre/")).toBe("atelier-camille");
    for (const path of ["/contact/atelier-camille", "/contact/atelier-camille/cadre/autre", "/events/pipeline", "/contact/../cadre", "/contact/AB/cadre", "/x/contact/atelier/cadre"]) {
      expect(contactFrameSlug(path)).toBeNull();
    }
  });
});
