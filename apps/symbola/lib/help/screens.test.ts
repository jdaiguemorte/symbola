import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "@symbola/i18n/messages/fr.json";
import en from "@symbola/i18n/messages/en.json";
import { HELP_SCREENS, screensFor } from "./screens";
import { TOUR_TARGETS } from "./tours";

type HelpEntry = { title: string; body: string; faq?: { q: string; a: string }[] };
const all = { hub: true, events: true, budget: true, quotes: true, vendors: true };

describe("AIDE-12 — Centre d'aide par écran, avec captures réelles", () => {
  it("chaque écran a son titre et son texte en français et en anglais, et ses questions dans les deux langues", () => {
    for (const screen of HELP_SCREENS) {
      for (const messages of [fr, en]) {
        const entry = (messages.Help as Record<string, HelpEntry>)[screen.key];
        expect(entry?.title, screen.key).toBeTruthy();
        expect(entry?.body, screen.key).toBeTruthy();
      }
      const frFaq = (fr.Help as Record<string, HelpEntry>)[screen.key]!.faq ?? [];
      const enFaq = (en.Help as Record<string, HelpEntry>)[screen.key]!.faq ?? [];
      expect(enFaq.length, screen.key).toBe(frFaq.length);
    }
  });

  it("chaque écran à capture a sa capture réelle dans public/aide/captures (script help:captures)", () => {
    for (const screen of HELP_SCREENS.filter((candidate) => candidate.capture)) {
      expect(existsSync(join(__dirname, "..", "..", "public", "aide", "captures", `${screen.key}.jpg`)), screen.key).toBe(true);
    }
  });

  it("les repères d'un écran existent, avec un texte par cible", () => {
    for (const screen of HELP_SCREENS.filter((candidate) => candidate.tour)) {
      const steps = (fr.Tour as Record<string, unknown[]>)[screen.tour!];
      expect(steps?.length, screen.key).toBe(TOUR_TARGETS[screen.tour!].length);
    }
  });

  it("l'équipe ne voit que les écrans de ses modules ; les données personnelles, seulement la titulaire", () => {
    const member = screensFor({ audience: "team", isOwner: false, modules: { ...all, quotes: false } }).map((screen) => screen.key);
    expect(member).toContain("eventsList");
    expect(member).not.toContain("quotesCatalog");
    expect(member).not.toContain("privacySearch");
    expect(screensFor({ audience: "team", isOwner: true, modules: all }).map((screen) => screen.key)).toContain("privacySearch");
  });

  it("l'Admin ne voit que les écrans de la console, les mariés que leur espace, et l'écran de connexion n'est dans aucun centre", () => {
    const admin = screensFor({ audience: "admin", isOwner: false, modules: all });
    expect(admin.every((screen) => screen.group === "admin")).toBe(true);
    const client = screensFor({ audience: "client", isOwner: false, modules: all });
    expect(client.every((screen) => screen.group === "clients")).toBe(true);
    expect(HELP_SCREENS.map((screen) => screen.key)).not.toContain("login");
  });
});

describe("AIDE-13 — Textes d'aide réécrits", () => {
  it("l'aide parle de « Mon compte et la sécurité », pas de connexion, pour quelqu'un déjà connecté", () => {
    expect((fr.Help as Record<string, HelpEntry>).profile!.title).toBe("Mon compte et la sécurité");
    expect((en.Help as Record<string, HelpEntry>).profile!.title).toBe("My account and security");
  });

  it("aucun texte d'aide ne renvoie encore à la visite guidée ni à la bulle d'aide", () => {
    const texts = JSON.stringify([fr.Help, fr.Tour]);
    expect(texts).not.toMatch(/visite guidée|relancer cette visite|Relancer la visite/i);
  });
});
