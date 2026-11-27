import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fr from "@symbola/i18n/messages/fr.json";
import en from "@symbola/i18n/messages/en.json";
import nextConfig from "../next.config";
import { isCurrentNavLink } from "./nav-current";
import {
  CLOSURE_PATH,
  COMPANY_ANCHOR_REDIRECTS,
  MERGED_RUBRIC_REDIRECTS,
  SETTINGS_MENU_HREFS,
  SETTINGS_RUBRIC_HREFS,
  YOUR_DATA_HREFS,
  companyAnchorTarget,
  settingsMenu,
  showsClosure,
  showsImport,
  yourDataLines,
  type SettingsMenuFlags,
} from "./settings-menu";
import { isSettingsPath } from "./settings-paths";
import { activeSettingsItem } from "./settings-search";

const ALL: SettingsMenuFlags = { events: true, budget: true, quotes: true, vendors: true, guests: true, appointments: true, isOwner: true, selfService: true };
const NONE: SettingsMenuFlags = { events: false, budget: false, quotes: false, vendors: false, guests: false, appointments: false, isOwner: false, selfService: false };
const MODULES = ["events", "budget", "quotes", "vendors", "guests", "appointments"] as const;

const hrefsOf = (flags: SettingsMenuFlags) => settingsMenu(flags).flatMap((group) => group.items.map((item) => item.href));
const dataOf = (flags: SettingsMenuFlags) => yourDataLines(flags).flatMap((line) => [line.href, ...line.secondary.map((other) => other.href)]);
const message = (messages: unknown, key: string) => key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], (messages as { SettingsMenu: unknown }).SettingsMenu);

// Toutes les combinaisons de modules du MVP, avec et sans le rôle de titulaire, avec et sans libre-service.
function* combinations(): Generator<SettingsMenuFlags> {
  for (let mask = 0; mask < 1 << MODULES.length; mask += 1) {
    for (const isOwner of [true, false]) {
      for (const selfService of [true, false]) {
        const flags = { ...NONE, isOwner, selfService };
        MODULES.forEach((module, index) => (flags[module] = Boolean(mask & (1 << index))));
        yield flags;
      }
    }
  }
}

// Les 53 entrées du menu d'avant le lot 74g, et les sous-écrans qu'elles ouvraient.
const OLD_ENTRIES = [
  "/parametres", "/profil", "/parametres/notifications", "/parametres/abonnement", "/parametres/automatisations", "/parametres/radar", "/parametres/equipe",
  "/parametres/emails", "/parametres/adresse-envoi", "/parametres/envois", "/parametres/messages", "/parametres/corbeille",
  "/events/parametres", "/events/parametres/sources", "/events/parametres/types", "/events/parametres/plages-occupees", "/events/parametres/termes",
  "/events/parametres/etapes", "/events/parametres/contact", "/events/parametres/questionnaires", "/events/modeles", "/events/parametres/taches",
  "/events/modeles-programme", "/events/modeles-evenement", "/events/parametres/listes-jour-j", "/events/parametres/regimes", "/events/parametres/repas",
  "/events/parametres/prestataires-par-lien", "/budget/parametres", "/parametres/relances",
  "/rendez-vous/reglages", "/rendez-vous/disponibilites",
  "/devis/catalogue", "/devis/modeles", "/devis/modeles-contrat", "/devis/modeles-proposition", "/devis/relances", "/devis/parametres", "/devis/parametres/documents",
  "/devis/e-reporting", "/devis/exports-comptables", "/devis/parametres/archive",
  "/prestataires/parametres", "/prestataires/parametres/etiquettes", "/prestataires/parametres/trajet", "/prestataires/parametres/pieces",
  "/import", "/rgpd", "/parametres/journal", "/parametres/export", "/parametres/reprise", "/parametres/fermeture", "/parametres/stockage",
];
const OLD_SUBSCREENS = [
  "/profil/signature", "/parametres/automatisations/rappel-jour-j", "/parametres/emails/acces", "/parametres/emails/marque", "/parametres/messages/3f0c2b1e-0000-4000-8000-000000000000",
  "/events/parametres/questionnaires/3f0c2b1e-0000-4000-8000-000000000000", "/events/modeles/3f0c2b1e-0000-4000-8000-000000000000",
  "/events/modeles-programme/3f0c2b1e-0000-4000-8000-000000000000", "/devis/modeles-contrat/3f0c2b1e-0000-4000-8000-000000000000",
  "/rendez-vous/reglages/types/3f0c2b1e-0000-4000-8000-000000000000", "/rgpd/demandes", "/apps",
];

describe("74g (G1, G2) — Huit groupes, 38 rubriques", () => {
  it("tous modules ouverts : huit groupes dans l'ordre du travail, 38 rubriques", () => {
    const groups = settingsMenu(ALL);
    expect(groups.map((group) => group.key)).toEqual(["company", "you", "events", "planning", "budgetVendors", "sales", "messages", "appointments"]);
    expect(groups.flatMap((group) => group.items)).toHaveLength(38);
  });

  it("P-22 : sept rubriques au plus par groupe, quelle que soit la combinaison", () => {
    for (const flags of combinations()) for (const group of settingsMenu(flags)) expect(group.items.length, `${group.key} ${JSON.stringify(flags)}`).toBeLessThanOrEqual(7);
  });

  it("chaque rubrique a un libellé et une phrase, en français et en anglais ; aucun libellé en double", () => {
    const items = settingsMenu(ALL).flatMap((group) => group.items);
    for (const messages of [fr, en]) {
      const labels = items.map((item) => message(messages, item.label));
      for (const [index, label] of labels.entries()) {
        expect(typeof label, items[index]!.label).toBe("string");
        expect(typeof message(messages, items[index]!.hint), items[index]!.hint).toBe("string");
      }
      expect(new Set(labels).size).toBe(labels.length);
      for (const group of settingsMenu(ALL)) {
        expect(typeof message(messages, group.label), group.label).toBe("string");
        expect(typeof message(messages, group.hint), group.hint).toBe("string");
      }
    }
  });

  it("C-71 : les rubriques jumelles commencent par ce qui les distingue", () => {
    const label = (key: string) => message(fr, `rubrics.${key}.label`) as string;
    expect(label("messageTemplates")).toMatch(/^Messages types/);
    expect(label("emailTemplates")).toMatch(/^E-mails automatiques/);
    expect(label("followUp")).toMatch(/^Prospects/);
    expect(label("paymentReminders")).toMatch(/^Paiements et propositions/);
    for (const key of ["vendorTypes", "vendorTags", "vendorDocuments", "vendorTravel"]) expect(label(key)).toMatch(/^Prestataires : /);
  });

  it("aucune adresse en double dans le menu d'une organisation", () => {
    for (const flags of combinations()) {
      const hrefs = hrefsOf(flags);
      expect(new Set(hrefs).size, JSON.stringify(flags)).toBe(hrefs.length);
    }
  });
});

describe("74g (ARC-06, ARC-07) — Un module non souscrit, un rôle", () => {
  it("sans module ni rôle de titulaire, restent l'entreprise, « Vous » et les automatismes", () => {
    expect(settingsMenu(NONE).map((group) => group.key)).toEqual(["company", "you", "messages"]);
    expect(hrefsOf(NONE)).toEqual(["/parametres/entreprise", "/parametres/mentions", "/profil", "/parametres/notifications", "/parametres/automatisations", "/parametres/radar"]);
  });

  it("un groupe d'un module non souscrit disparaît ; une rubrique d'un module non souscrit n'est pas proposée", () => {
    for (const flags of combinations()) {
      const keys = settingsMenu(flags).map((group) => group.key);
      expect(keys.includes("events"), JSON.stringify(flags)).toBe(flags.events);
      expect(keys.includes("planning")).toBe(flags.events);
      expect(keys.includes("sales")).toBe(flags.quotes);
      expect(keys.includes("appointments")).toBe(flags.appointments);
      expect(keys.includes("budgetVendors")).toBe(flags.events || flags.budget || flags.vendors);
      const hrefs = hrefsOf(flags);
      expect(hrefs.includes("/events/parametres/regimes")).toBe(flags.events && flags.guests);
      expect(hrefs.some((href) => href.startsWith("/prestataires/"))).toBe(flags.vendors);
      expect(hrefs.some((href) => href.startsWith("/devis/"))).toBe(flags.quotes);
    }
  });

  it("le budget : les postes et la répartition à /events/parametres ; sans Évènements, la répartition à /budget/parametres", () => {
    expect(hrefsOf({ ...ALL })).toContain("/events/parametres");
    expect(hrefsOf({ ...ALL })).not.toContain("/budget/parametres");
    expect(hrefsOf({ ...NONE, budget: true })).toContain("/budget/parametres");
    expect(hrefsOf({ ...NONE, events: true })).toContain("/events/parametres");
  });

  it("les rubriques gardées par requireOwner (équipe, étapes et contact) restent hors du menu de l'équipe, comme avant", () => {
    const member = hrefsOf({ ...ALL, isOwner: false });
    for (const href of ["/parametres/equipe", "/events/parametres/etapes", "/parametres/abonnement", "/apps"]) expect(member, href).not.toContain(href);
  });

  it("« titulaire » marque les rubriques que l'équipe lit sans les changer", () => {
    const owner = settingsMenu({ ...ALL, isOwner: false }).flatMap((group) => group.items).filter((item) => item.owner).map((item) => item.href);
    expect(owner.sort()).toEqual(["/events/parametres/prestataires-par-lien", "/parametres/adresse-envoi", "/parametres/automatisations", "/parametres/radar"].sort());
  });

  it("« Abonnement et modules » : la titulaire l'a toujours ; sans libre-service, il ouvre « Tous les modules »", () => {
    expect(hrefsOf({ ...ALL, selfService: true })).toContain("/parametres/abonnement");
    expect(hrefsOf({ ...ALL, selfService: false })).toContain("/apps");
    expect(hrefsOf({ ...ALL, selfService: false })).not.toContain("/parametres/abonnement");
  });
});

describe("74g (G5) — « Vos données »", () => {
  it("huit lignes pour la titulaire, tous modules ouverts ; « Fermer l'espace » à part, en dernier", () => {
    expect(yourDataLines(ALL).map((line) => line.key)).toEqual(["export", "organizationImport", "trash", "activityLog", "emailDeliveries", "privacy", "storage", "accounting"]);
    expect(showsClosure(ALL)).toBe(true);
  });

  it("les droits d'aujourd'hui : un membre de l'équipe ne voit que la corbeille, les e-mails envoyés et la comptabilité qu'il lisait", () => {
    const member = { ...ALL, isOwner: false };
    expect(yourDataLines(member).map((line) => line.key)).toEqual(["trash", "emailDeliveries", "accounting"]);
    expect(dataOf(member)).not.toContain("/devis/parametres/archive");
    expect(showsClosure(member)).toBe(false);
  });

  it("chaque ligne a son libellé et sa phrase en français et en anglais", () => {
    for (const messages of [fr, en]) {
      for (const line of yourDataLines(ALL)) {
        expect(typeof message(messages, line.label), line.label).toBe("string");
        expect(typeof message(messages, line.hint), line.hint).toBe("string");
        for (const other of line.secondary) expect(typeof message(messages, other.label), other.label).toBe("string");
      }
    }
  });

  it("« Reprendre et importer » sort des Paramètres, avec un module qui importe", () => {
    expect(isSettingsPath("/import")).toBe(false);
    expect(showsImport(NONE)).toBe(false);
    expect(showsImport({ ...NONE, quotes: true })).toBe(true);
  });
});

describe("74g (critère 2) — Chaque adresse d'aujourd'hui s'ouvre encore", () => {
  const redirected = new Map(MERGED_RUBRIC_REDIRECTS.map((rule) => [rule.source, rule.destination]));
  const groups = [...settingsMenu(ALL), { items: [...yourDataLines(ALL).flatMap((line) => [line, ...line.secondary]), { href: CLOSURE_PATH, label: "" }] }];

  it("les 53 entrées d'avant : une rubrique, une ligne de « Vos données », l'import, ou une redirection vers une rubrique", () => {
    expect(OLD_ENTRIES).toHaveLength(53);
    for (const href of OLD_ENTRIES) {
      const target = redirected.get(href)?.split("#")[0] ?? href;
      const found = href === "/parametres" || href === "/import" || href === "/budget/parametres" || activeSettingsItem(groups, target) !== undefined;
      expect(found, href).toBe(true);
    }
  });

  it("les 12 sous-écrans restent dans leur rubrique", () => {
    expect(OLD_SUBSCREENS).toHaveLength(12);
    for (const href of OLD_SUBSCREENS) {
      expect(isSettingsPath(href), href).toBe(true);
      expect(activeSettingsItem(groups, href), href).toBeDefined();
    }
  });

  it("chaque page d'arrivée existe dans l'app", () => {
    const app = join(__dirname);
    for (const href of [...SETTINGS_RUBRIC_HREFS, ...YOUR_DATA_HREFS]) expect(existsSync(join(app, href, "page.tsx")), href).toBe(true);
  });

  it("les rubriques fondues : leur ancienne adresse mène à leur bloc, par le serveur (non permanent)", async () => {
    const rules = (await nextConfig.redirects?.()) ?? [];
    for (const rule of MERGED_RUBRIC_REDIRECTS) {
      expect(rules, rule.source).toContainEqual({ source: rule.source, destination: rule.destination, permanent: false });
      const [path, anchor] = rule.destination.split("#");
      expect(readFileSync(join(__dirname, path!, "page.tsx"), "utf-8"), rule.destination).toMatch(new RegExp(`id="${anchor}"|id=\\{"${anchor}"\\}|anchor="${anchor}"`));
    }
  });

  it("les ancres de l'ancien « Entreprise et TVA » mènent à leur rubrique, au bon bloc", () => {
    expect(companyAnchorTarget("#tva-debits")).toBe("/parametres/entreprise#tva-debits");
    expect(companyAnchorTarget("#informations-professionnel")).toBe("/parametres/mentions#informations-professionnel");
    expect(companyAnchorTarget("#fiche")).toBe("/parametres/entreprise");
    expect(companyAnchorTarget("#documents")).toBe("/parametres/mentions");
    expect(companyAnchorTarget("#inconnu")).toBeNull();
    expect(companyAnchorTarget("")).toBeNull();
    for (const [anchor, path] of Object.entries(COMPANY_ANCHOR_REDIRECTS)) {
      if (anchor === "fiche" || anchor === "documents") continue;
      const source = [join(__dirname, path, "page.tsx"), ...["company-sheet-form.tsx"].map((file) => join(__dirname, "parametres", file))].map((file) => readFileSync(file, "utf-8")).join("\n");
      expect(source, anchor).toContain(`id="${anchor}"`);
    }
  });
});

describe("74g — Les liens qui mènent aux réglages de l'entreprise", () => {
  // Les liens que la planner suit quand une mention légale manque à un devis (« Il manque … ») et ceux
  // des contrôles de conformité : chacun ouvre la rubrique, au bloc du réglage, sans passer par l'ancre.
  const sources = [
    readFileSync(join(__dirname, "devis", "missing-mentions.tsx"), "utf-8"),
    readFileSync(join(__dirname, "..", "..", "..", "packages", "starter-templates", "src", "compliance-checks.json"), "utf-8"),
  ];
  const links = sources.flatMap((source) => [...source.matchAll(/["'`](\/(?:devis\/)?parametres[^"'`\s]*)["'`]/g)].map((match) => match[1]!));

  it("aucun lien ne vise plus l'ancien écran « Entreprise et TVA » par une ancre", () => {
    expect(links).toHaveLength(16);
    for (const link of links) expect(link, link).not.toMatch(/^\/parametres#/);
  });

  it("chaque lien vise une rubrique et un bloc qui existent", () => {
    for (const link of links) {
      const [path, anchor] = link.split("#");
      expect(SETTINGS_MENU_HREFS, link).toContain(path);
      if (!anchor || !path!.startsWith("/parametres/")) continue;
      const files = [join(__dirname, path!, "page.tsx"), join(__dirname, "parametres", "company-sheet-form.tsx"), join(__dirname, "parametres", "professional-mentions-form.tsx")];
      expect(files.map((file) => readFileSync(file, "utf-8")).join("\n"), link).toContain(`id="${anchor}"`);
    }
  });
});

describe("UX-13 (L13-HUB-16) — Une rubrique des Paramètres s'ouvre dans les Paramètres", () => {
  it("chaque rubrique, l'accueil et « Vos données » sont des écrans de réglage : « Paramètres » reste allumé", () => {
    for (const href of SETTINGS_MENU_HREFS) {
      expect(isSettingsPath(href), href).toBe(true);
      expect(isCurrentNavLink(href, "/parametres", { settings: true }), href).toBe(true);
    }
  });

  it("les écrans de métier ne deviennent pas des réglages", () => {
    for (const path of ["/", "/devis", "/devis/3f0c2b1e-0000-4000-8000-000000000000", "/devis/encaissements", "/devis/factures/abc", "/events", "/events/abc", "/rendez-vous", "/prestataires", "/import", "/import/abc", "/aide", "/tutoriels"]) {
      expect(isSettingsPath(path), path).toBe(false);
    }
  });
});
