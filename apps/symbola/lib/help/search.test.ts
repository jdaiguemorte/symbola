// Lot 74f (HUB-12, HUB-11, UX-10 ; spécification du lot 74, § 6.6, critère 1 ; maquette 27) — le moteur de la
// recherche de l'aide, joué sur les vrais articles (fichiers de messages FR et EN) et les vrais mots voisins.
import { describe, expect, it, vi } from "vitest";
import fr from "../../../../packages/i18n/src/messages/fr.json";
import en from "../../../../packages/i18n/src/messages/en.json";
import { articlesFor, topicCounts, type HelpMessage } from "./articles";
import type { HelpModule } from "./catalog";
import type { HelpViewer } from "./screens";
import lexicons from "./help-synonyms.json";
import { indexArticles, readQuery, searchHelp, wordsMatch, HELP_SEARCH_OTHERS } from "./search";

const ALL: Record<HelpModule, boolean> = { hub: true, events: true, budget: true, quotes: true, vendors: true, guests: true, appointments: true, floorplans: true };
const owner: HelpViewer = { audience: "team", isOwner: true, modules: ALL };
const frArticles = indexArticles(articlesFor(owner, fr.Help as Record<string, HelpMessage>));
const enArticles = indexArticles(articlesFor(owner, en.Help as Record<string, HelpMessage>));
const bestFr = (query: string) => searchHelp(query, frArticles, lexicons.fr).best?.key ?? null;
const bestEn = (query: string) => searchHelp(query, enArticles, lexicons.en).best?.key ?? null;

// Les phrases de la planner (maquette 27, PC-08) et leur article attendu en meilleure réponse.
const FR_PHRASES: [string, string][] = [
  ["importer mes contacts", "importFile"],
  ["importer contacts", "importFile"],
  ["reprendre mon tableau excel", "importFile"],
  ["import", "importFile"],
  ["comment reprendre un mariage en cours", "takeover"],
  ["créer un mariage", "eventsNew"],
  ["ajouter un prestataire", "vendorNew"],
  ["qu'est-ce que le SIRET", "settings"],
  ["plan de table", "seatingPlan"],
  ["les allergies des invités", "dietaryOptions"],
  ["modèle de rétroplanning", "eventsTemplates"],
  ["exporter mes données", "organizationExport"],
  ["fusionner deux contacts en double", "contactMerge"],
  ["mes disponibilités pour les rendez-vous", "appointmentAvailability"],
  ["modèle de contrat", "contractTemplates"],
];

describe("HUB-12 — Recherche de l'aide : une phrase comprise, une meilleure réponse (lot 74f)", () => {
  it.each(FR_PHRASES)("« %s » rend son article en meilleure réponse", (query, expected) => {
    expect(bestFr(query)).toBe(expected);
  });

  it("les petits mots sont écartés et ce qui est compris est dit : « importer mes contacts » → importer · contacts", () => {
    expect(searchHelp("Comment importer mes contacts ?", frArticles, lexicons.fr).understood).toEqual(["importer", "contacts"]);
    expect(searchHelp("How do I import my contacts?", enArticles, lexicons.en).understood).toEqual(["import", "contacts"]);
  });

  it("deux mots voisins ne font qu'une idée (« tableau excel »), une expression connue reste entière (« plan de table »)", () => {
    expect(readQuery("reprendre mon tableau excel", lexicons.fr).map((concept) => concept.label)).toEqual(["reprendre", "tableau"]);
    expect(readQuery("faire un plan de table", lexicons.fr).map((concept) => concept.label)).toEqual(["faire", "plan de table"]);
  });

  it("« import » met la bonne réponse en tête, devant les étapes de l'import et l'import d'un chrono", () => {
    const result = searchHelp("import", frArticles, lexicons.fr);
    expect(result.best?.key).toBe("importFile");
    expect(result.others.map((article) => article.key)).not.toContain("importFile");
  });

  it("une meilleure réponse, puis quatre autres au plus", () => {
    const result = searchHelp("mariage", frArticles, lexicons.fr);
    expect(result.best).not.toBeNull();
    expect(result.others.length).toBeLessThanOrEqual(HELP_SEARCH_OTHERS);
  });

  it("la meilleure réponse de « importer mes contacts » se lit sans l'ouvrir : un résumé en étapes et l'écran à ouvrir", () => {
    const best = searchHelp("importer mes contacts", frArticles, lexicons.fr).best!;
    expect(best.steps.length).toBeGreaterThanOrEqual(3);
    expect(best.screenHref).toBe("/import");
  });

  it("les fautes courantes sont tolérées sur les mots longs (« importr mes contacs », « prestatair »)", () => {
    expect(bestFr("importr mes contacs")).toBe("importFile");
    expect(bestFr("nouveau prestatair")).toBe("vendorNew");
    expect(wordsMatch("contacs", "contacts")).toBe(true);
    // … mais un mot court n'est jamais rapproché d'un autre par une faute.
    expect(wordsMatch("tva", "tri")).toBe(false);
  });

  it("aucune réponse : la phrase est rendue vide, jamais une réponse au hasard", () => {
    const result = searchHelp("parrainer une consœur", frArticles, lexicons.fr);
    expect(result.best).toBeNull();
    expect(result.others).toEqual([]);
    expect(result.understood).toEqual(["parrainer", "consœur"]);
    expect(searchHelp("le la les", frArticles, lexicons.fr)).toEqual({ understood: [], best: null, others: [] });
  });

  it("en anglais, les mêmes phrases trouvent les mêmes articles", () => {
    expect(bestEn("import my contacts")).toBe("importFile");
    expect(bestEn("bring in my excel spreadsheet")).toBe("importFile");
    expect(bestEn("create a wedding")).toBe("eventsNew");
    expect(bestEn("seating plan")).toBe("seatingPlan");
    expect(bestEn("export my data")).toBe("organizationExport");
    expect(bestEn("sponsor a colleague planner")).not.toBe("importFile");
  });

  it("la recherche ne journalise rien : aucune phrase cherchée n'est écrite dans la console (SEC-20)", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) => vi.spyOn(console, method));
    searchHelp("importer les contacts de Camille Roussel", frArticles, lexicons.fr);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    for (const spy of spies) spy.mockRestore();
  });

  it("répond en moins de 500 ms (HUB-12) : l'index se construit une fois, puis chaque phrase se cherche", () => {
    // L'index est construit une fois par jeu de messages et par lecteur, puis gardé par le serveur
    // (lib/help/help-center.ts) ; il est mesuré à part, à froid, sous le même seuil.
    let start = performance.now();
    const index = indexArticles(articlesFor(owner, fr.Help as Record<string, HelpMessage>));
    expect(performance.now() - start).toBeLessThan(500);
    // Chaque phrase, mots voisins compris, à froid (rien n'est encore rapproché dans cet index) : la plus
    // lente reste sous le seuil, et les quinze ensemble aussi.
    const times: number[] = [];
    start = performance.now();
    for (const [query] of FR_PHRASES) {
      const one = performance.now();
      searchHelp(query, index, lexicons.fr);
      times.push(performance.now() - one);
    }
    expect(performance.now() - start).toBeLessThan(500);
    expect(Math.max(...times)).toBeLessThan(500);
  });
});

describe("ARC-06 — Un article d'un module non souscrit n'est jamais rendu par la recherche (lot 74f)", () => {
  it("sans le module Invités, « plan de table » ne rend aucun article des invités", () => {
    const viewer: HelpViewer = { audience: "team", isOwner: true, modules: { ...ALL, guests: false } };
    const articles = articlesFor(viewer, fr.Help as Record<string, HelpMessage>);
    const result = searchHelp("plan de table des invités", articles, lexicons.fr);
    const keys = [result.best?.key, ...result.others.map((article) => article.key)];
    expect(keys).not.toContain("seatingPlan");
    expect(keys).not.toContain("guests");
  });

  it("sans les Rendez-vous, aucun article des rendez-vous ; un membre ne lit pas les articles réservés à la titulaire", () => {
    const member: HelpViewer = { audience: "team", isOwner: false, modules: { ...ALL, appointments: false } };
    const articles = articlesFor(member, fr.Help as Record<string, HelpMessage>);
    expect(articles.some((article) => article.topic === "appointments")).toBe(false);
    expect(articles.map((article) => article.key)).not.toContain("privacySearch");
    expect(searchHelp("données personnelles", articles, lexicons.fr).best?.key).not.toBe("privacySearch");
  });

  it("l'Admin (exploitation) ne lit que l'aide de la console, jamais un article d'organisation (SEC-09)", () => {
    const admin: HelpViewer = { audience: "admin", isOwner: false, modules: { ...ALL } };
    const articles = articlesFor(admin, fr.Help as Record<string, HelpMessage>);
    expect(articles.every((article) => article.topic === "admin")).toBe(true);
    const result = searchHelp("importer mes contacts", articles, lexicons.fr);
    expect([result.best, ...result.others].every((article) => article === null || article.topic === "admin")).toBe(true);
  });
});

describe("HUB-11 — Le centre d'aide par sujet (lot 74f, maquette 27)", () => {
  it("chaque sujet dit son nombre d'articles ; « Reprise et import » est un sujet à part", () => {
    const counts = topicCounts(articlesFor(owner, fr.Help as Record<string, HelpMessage>));
    expect(counts.map((entry) => entry.topic)).toEqual(["events", "appointments", "vendors", "quotes", "budget", "import", "company", "data"]);
    expect(counts.find((entry) => entry.topic === "import")!.count).toBeGreaterThanOrEqual(10);
    expect(counts.every((entry) => entry.count > 0)).toBe(true);
  });
});
