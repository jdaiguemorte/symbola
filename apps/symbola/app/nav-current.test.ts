import { describe, expect, it } from "vitest";
import { isCurrentNavLink } from "./nav-current";

describe("L18-HUB-22 — Un seul lien du menu principal allumé", () => {
  it("sur Encaissements, seul « Encaissements » est allumé, pas « Devis et factures »", () => {
    expect(isCurrentNavLink("/devis/encaissements", "/devis/encaissements")).toBe(true);
    expect(isCurrentNavLink("/devis/encaissements", "/devis", { except: ["/devis/encaissements"] })).toBe(false);
  });

  it("sur un devis, une facture ou un avoir, « Devis et factures » reste allumé", () => {
    for (const path of ["/devis", "/devis/3f0c2b1e-0000-4000-8000-000000000000", "/devis/factures/abc", "/devis/avoirs/abc"]) {
      expect(isCurrentNavLink(path, "/devis", { except: ["/devis/encaissements"] }), path).toBe(true);
    }
  });

  it("un écran de réglage allume « Paramètres », pas le module", () => {
    expect(isCurrentNavLink("/devis/parametres/documents", "/devis", { except: ["/devis/encaissements"] })).toBe(false);
    expect(isCurrentNavLink("/devis/parametres/documents", "/parametres", { settings: true })).toBe(true);
  });

  it("l'accueil ne s'allume que sur lui-même ; « exact » ignore les sous-écrans", () => {
    expect(isCurrentNavLink("/", "/")).toBe(true);
    expect(isCurrentNavLink("/events", "/")).toBe(false);
    expect(isCurrentNavLink("/admin/organisations", "/admin", { exact: true })).toBe(false);
  });
});
