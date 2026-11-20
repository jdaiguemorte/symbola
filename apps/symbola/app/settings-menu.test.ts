import { describe, expect, it } from "vitest";
import { isCurrentNavLink } from "./nav-current";
import { SETTINGS_MENU_HREFS, settingsMenu } from "./settings-menu";
import { isSettingsPath } from "./settings-paths";

const ALL = { events: true, budget: true, quotes: true, vendors: true, guests: true, appointments: true, isOwner: true, selfService: true };
const NONE = { events: false, budget: false, quotes: false, vendors: false, guests: false, appointments: false, isOwner: false, selfService: false };

describe("UX-13 (L13-HUB-16) — Une rubrique des Paramètres s'ouvre dans les Paramètres (lot 61)", () => {
  it("chaque rubrique du menu est un écran de réglage : le menu des réglages reste affiché", () => {
    for (const href of SETTINGS_MENU_HREFS) expect(isSettingsPath(href), href).toBe(true);
  });

  it("les six rubriques signalées en recette allument « Paramètres », plus « Devis et factures » ni « Événements »", () => {
    const reported = ["/devis/exports-comptables", "/devis/relances", "/devis/modeles-proposition", "/devis/modeles-contrat", "/devis/modeles", "/events/modeles-evenement"];
    for (const path of reported) {
      expect(isCurrentNavLink(path, "/parametres", { settings: true }), path).toBe(true);
      expect(isCurrentNavLink(path, path.startsWith("/devis") ? "/devis" : "/events", { except: ["/devis/encaissements"] }), path).toBe(false);
    }
  });

  it("leurs sous-écrans restent dans les Paramètres (un modèle de devis ouvert)", () => {
    expect(isSettingsPath("/devis/modeles/3f0c2b1e-0000-4000-8000-000000000000")).toBe(true);
    expect(isSettingsPath("/events/modeles-evenement/3f0c2b1e-0000-4000-8000-000000000000")).toBe(true);
  });

  it("les écrans de métier ne deviennent pas des réglages", () => {
    for (const path of ["/", "/devis", "/devis/3f0c2b1e-0000-4000-8000-000000000000", "/devis/encaissements", "/devis/factures/abc", "/events", "/events/abc", "/rendez-vous", "/prestataires", "/import/abc"]) {
      expect(isSettingsPath(path), path).toBe(false);
    }
  });

  it("aucune adresse en double ; chaque rubrique a un libellé", () => {
    expect(new Set(SETTINGS_MENU_HREFS).size).toBe(SETTINGS_MENU_HREFS.length);
    for (const group of settingsMenu(ALL)) for (const item of group.items) expect(item.label, item.href).not.toBe("");
  });

  it("ARC-06 : sans module ni rôle de titulaire, seules restent les rubriques communes", () => {
    const hrefs = settingsMenu(NONE).flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toEqual(["/parametres", "/profil", "/parametres/notifications", "/parametres/automatisations", "/parametres/radar", "/parametres/corbeille"]);
  });

  it("les rubriques de la titulaire (équipe, données, archive) sont masquées aux autres rôles", () => {
    const member = settingsMenu({ ...ALL, isOwner: false }).flatMap((group) => group.items.map((item) => item.href));
    for (const href of ["/parametres/equipe", "/parametres/abonnement", "/rgpd", "/parametres/export", "/parametres/fermeture", "/devis/parametres/archive", "/events/parametres/etapes"]) {
      expect(member, href).not.toContain(href);
    }
  });
});
