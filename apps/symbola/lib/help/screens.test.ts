import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "@symbola/i18n/messages/fr.json";
import en from "@symbola/i18n/messages/en.json";
import { GENERIC_ILLUSTRATION, HELP_SCREENS, screensFor, tileImage } from "./screens";
import { starterTour } from "@symbola/starter-templates";

type HelpEntry = { title: string; body: string; faq?: { q: string; a: string }[] };
const all = { hub: true, events: true, budget: true, quotes: true, vendors: true, guests: true, appointments: true, floorplans: true };

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

  // Lot 63f (HUB-11 ; ADR 0104) : la visite guidée remplace les repères.
  it("HUB-11 — chaque zone citée par une visite existe sur les écrans (attribut data-tour)", () => {
    const appDirectory = join(__dirname, "..", "..", "app");
    const sources = files(appDirectory).map((path) => readFileSync(path, "utf-8")).join("\n");
    for (const screen of HELP_SCREENS.filter((candidate) => candidate.tour)) {
      for (const step of starterTour("fr", screen.tour!)) {
        if (!step.target) continue;
        // Les onglets de la fiche portent « tab-<clé> », écrit par le code ; un lien de réglages reçoit
        // sa zone par sa propriété « tour ».
        const found = sources.includes(`data-tour="${step.target}"`) || sources.includes(`tour="${step.target}"`) || (step.target.startsWith("tab-") && sources.includes("data-tour={`tab-${"));
        expect(found, `${screen.key} : ${step.target}`).toBe(true);
      }
    }
  });

  it("l'équipe ne voit que les écrans de ses modules ; les données personnelles, seulement la titulaire", () => {
    const member = screensFor({ audience: "team", isOwner: false, modules: { ...all, quotes: false } }).map((screen) => screen.key);
    expect(member).toContain("eventsList");
    expect(member).not.toContain("quotesCatalog");
    expect(member).not.toContain("privacySearch");
    expect(screensFor({ audience: "team", isOwner: true, modules: all }).map((screen) => screen.key)).toContain("privacySearch");
  });

  it("l'Admin ne voit que les écrans de la console, et l'écran de connexion n'est dans aucun centre", () => {
    const admin = screensFor({ audience: "admin", isOwner: false, modules: all });
    expect(admin.every((screen) => screen.group === "admin")).toBe(true);
    expect(HELP_SCREENS.map((screen) => screen.key)).not.toContain("login");
  });

  it("L26-UX-11 — le portail d'un lien n'est pas dans le centre d'aide (les tiers n'ont pas de compte)", () => {
    expect(HELP_SCREENS.map((screen) => screen.key)).not.toContain("clientSpace");
    expect(HELP_SCREENS.map((screen) => screen.key)).not.toContain("clientSecurity");
  });
});

describe("AIDE-13 — Textes d'aide réécrits", () => {
  it("l'aide parle de « Mon compte et la sécurité », pas de connexion, pour quelqu'un déjà connecté", () => {
    expect((fr.Help as Record<string, HelpEntry>).profile!.title).toBe("Mon compte et la sécurité");
    expect((en.Help as Record<string, HelpEntry>).profile!.title).toBe("My account and security");
  });

  // Lot 63f (ADR 0104) : la visite guidée revient, les repères numérotés partent.
  it("aucun texte d'aide ne parle encore des repères numérotés", () => {
    const texts = JSON.stringify([fr.Help, fr.HelpCenter, fr.HelpUi, en.Help, en.HelpCenter, en.HelpUi]);
    expect(texts).not.toMatch(/repères numérotés|repère suivant|numbered markers|next marker/i);
  });
});

// Lot 20 (AIDE-14) : un écran sans aide déclarée faisait mener le « ? » au
// centre d'aide, pris pour un renvoi vers les tutoriels.
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return files(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function pages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

describe("AIDE-14 — Chaque écran a son aide", () => {
  it("chaque écran déclare son aide (fiche ou visite guidée), sauf le centre d'aide lui-même et les pages hors session ou de simple redirection", () => {
    const appDirectory = join(__dirname, "..", "..", "app");
    // Le centre d'aide (son « ? » y mène déjà), les liens reçus par e-mail
    // (nouveau mot de passe, signature d'essai, lot 26a : arrivée d'un lien
    // personnel, qui ne fait qu'ouvrir le portail) et les adresses qui redirigent.
    // Lot 33 : « Sécurisez votre compte » est une étape de passage, hors session complète.
    // Lot 37a : arrivée d'un lien de partage, qui n'ouvre qu'un document, sans session.
    // Lot 46 : page publique de réservation et arrivée d'un lien de gestion, sans session ; leurs
    // textes disent eux-mêmes ce qu'il faut faire.
    const exempt = [/^aide\//, /^securite\/page\.tsx$/, /^signature-fictive\//, /^lien\/page\.tsx$/, /^partage\/page\.tsx$/, /^reserver\//, /^rdv\/page\.tsx$/];
    const missing = pages(appDirectory)
      .map((path) => ({ path: relative(appDirectory, path), source: readFileSync(path, "utf-8") }))
      .filter(({ path }) => !exempt.some((pattern) => pattern.test(path)))
      .filter(({ source }) => source.includes("<main") || source.includes("<PageHeader"))
      .filter(({ source }) => !/<ScreenHelp|<PageTour/.test(source))
      .map(({ path }) => path);
    expect(missing).toEqual([]);
  });

  it("les écrans de réglage ajoutés au lot 20 sont dans le centre d'aide", () => {
    const keys = HELP_SCREENS.map((screen) => screen.key);
    for (const key of ["eventsSources", "eventTypes", "followUps", "vendorTypes", "vendorTags", "vendorTravel", "vendorDetail", "vendorNew", "search", "tutorials"]) {
      expect(keys, key).toContain(key);
    }
  });
});

describe("AIDE-16 — Une image pour chaque écran du centre d'aide", () => {
  it("un écran sans capture montre l'illustration générique, qui existe ; un écran avec capture montre la sienne", () => {
    expect(existsSync(join(__dirname, "..", "..", "public", GENERIC_ILLUSTRATION))).toBe(true);
    for (const screen of HELP_SCREENS) {
      expect(tileImage(screen), screen.key).toBe(screen.capture ? `/aide/captures/${screen.key}.jpg` : GENERIC_ILLUSTRATION);
    }
  });
});
