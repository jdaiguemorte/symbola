// Lot 40c (NFR-01, NFR-02, UX-15, HUB-12 ; décisions D15, D16 ; ADR 0078) — le temps de réponse,
// mesuré à chaque version sur l'app compilée :
// - affichage (NFR-01) : chaque écran des parcours P0 ouvert à froid (sans cache) en profil
//   « téléphone de milieu de gamme en 4G » (celui de Lighthouse pour mobile : 1,6 Mbit/s, latence
//   150 ms, processeur ralenti quatre fois) ; le plus grand affichage (LCP) sous 2,5 s, et aucune
//   erreur dans la page (l'erreur d'hydratation de la fiche, corrigée au lot 40c, en était une) ;
// - interaction : la réaction visible à un geste sous 200 ms, sous 100 ms pour un geste optimiste
//   (UX-15), processeur ralenti quatre fois ;
// - serveur (NFR-02) : 95e centile des pages des parcours P0 sous 300 ms, recherche (HUB-12) sous
//   500 ms.
// Chromium seulement (bridage par le protocole des outils de développement), une fois par version.
// Les chiffres vont au résumé du job de CI et au rapport des parcours.
import { appendFileSync } from "node:fs";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { atelier40c, type Atelier40c } from "./atelier-40c";
import { signIn } from "./helpers";

const LCP_LIMIT_MS = 2500;
const GESTURE_LIMIT_MS = 200;
const OPTIMISTIC_LIMIT_MS = 100;
const SERVER_P95_LIMIT_MS = 300;
const SEARCH_P95_LIMIT_MS = 500;
const SERIES = 3;
const MOBILE_4G = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };

// Lot 65 : chaque mesure est indépendante (préparation commune dans beforeAll, refaite par un
// nouveau processus après un échec). En mode « serial », l'échec d'un geste (NFR-01) sautait la
// mesure du serveur (NFR-02) à chaque reprise de la CI : elle n'était jouée qu'une fois.
test.describe.configure({ mode: "default" });

let setup: Atelier40c;
// Sessions de la titulaire et des mariés (lien échangé), reprises par chaque contexte neuf (cache
// vide, connexion gardée).
let session!: Awaited<ReturnType<BrowserContext["storageState"]>>;
let coupleSession!: Awaited<ReturnType<BrowserContext["storageState"]>>;
const lines: string[] = [];

function percentile(values: number[], rank: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((rank / 100) * sorted.length) - 1)]!;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

async function throttled(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", MOBILE_4G);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

// Écran ouvert à froid (contexte neuf, aucun cache) : plus grand affichage et erreurs de la page.
async function coldLoad(browser: Browser, url: string, storageState: typeof session): Promise<{ lcp: number; errors: string[] }> {
  const context = await browser.newContext({ storageState, locale: "fr-FR", viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message.slice(0, 200)));
    await page.addInitScript(() => {
      (window as unknown as { __lcp: number }).__lcp = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) (window as unknown as { __lcp: number }).__lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    await throttled(page);
    await page.goto(url, { waitUntil: "load" });
    await page.waitForTimeout(800);
    const lcp = await page.evaluate(() => (window as unknown as { __lcp: number }).__lcp);
    return { lcp: Math.round(lcp), errors };
  } finally {
    await context.close();
  }
}

// Une mesure ne vaut que seule : la CI joue un parcours à la fois ; en local, `--workers=1`. Sous la
// charge de parcours en parallèle, le serveur répondait à 314 ms au lieu de 130 (17/11/2026).
function measured(testInfo: { project: { name: string }; config: { workers: number } }): boolean {
  return testInfo.project.name === "desktop" && testInfo.config.workers === 1;
}

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "mesures : une fois par version, sous Chromium");
  test.skip(testInfo.config.workers !== 1, "mesures : un seul parcours à la fois (la CI, ou --workers=1 en local)");
});

test.beforeAll(async ({ browser }, testInfo) => {
  if (!measured(testInfo)) return;
  setup = await atelier40c("mesures");
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  await signIn(page, setup.email, /\/$/);
  session = await context.storageState();
  await context.close();
  // Le lien des mariés s'échange une fois contre leur session du portail.
  const couple = await browser.newContext({ locale: "fr-FR" });
  const portal = await couple.newPage();
  await portal.goto(setup.coupleUrl);
  await expect(portal).toHaveURL(/\/portail$/);
  coupleSession = await couple.storageState();
  await couple.close();
});

test.afterAll(({}, testInfo) => {
  if (!measured(testInfo) || lines.length === 0) return;
  const report = ["### Mesures du lot 40c (NFR-01, NFR-02, UX-15, HUB-12)", "", "| Mesure | Valeur | Seuil |", "| --- | ---: | ---: |", ...lines, ""].join("\n");
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
});

test("NFR-01 — chaque écran des parcours P0 s'affiche en moins de 2,5 s sur un téléphone de milieu de gamme en 4G, sans erreur", async ({ browser }) => {
  test.setTimeout(240_000);
  const screens: [string, string, typeof session][] = [
    ["Aujourd'hui", "/", session],
    ["Tâches", "/taches", session],
    ["Synthèse de l'évènement", `/events/${setup.eventId}`, session],
    ["Rétroplanning", `/events/${setup.eventId}?onglet=retroplanning`, session],
    ["Budget", `/budget/${setup.eventId}/detail`, session],
    ["Devis", "/devis", session],
    ["Contacts", "/contacts", session],
    ["Jour J", `/jour-j/${setup.eventId}`, session],
    ["Portail des mariés", "/portail", coupleSession],
  ];
  const problems: string[] = [];
  for (const [name, url, storageState] of screens) {
    const { lcp, errors } = await coldLoad(browser, url, storageState);
    lines.push(`| Affichage : ${name} | ${lcp} ms | ${LCP_LIMIT_MS} ms |`);
    if (lcp === 0 || lcp > LCP_LIMIT_MS) problems.push(`${name} : ${lcp} ms`);
    for (const error of errors) problems.push(`${name} : erreur dans la page (${error})`);
  }
  expect(problems).toEqual([]);
});

test("NFR-01, UX-15 — un geste optimiste réagit en moins de 100 ms ; ⌘K ouvre la palette en moins de 200 ms", async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ storageState: session, locale: "fr-FR" });
  try {
    const page = await context.newPage();
    await page.goto("/taches");
    await expect(page.getByRole("button", { name: "Marquer « Confirmer le lieu » comme faite" })).toBeVisible();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    const check = await page.evaluate(async () => {
      const button = document.querySelector<HTMLButtonElement>("button[aria-label='Marquer « Confirmer le lieu » comme faite']");
      if (!button) return -1;
      const start = performance.now();
      const reacted = new Promise<number>((done) => {
        const observer = new MutationObserver(() => {
          if (button.getAttribute("aria-pressed") === "true") {
            observer.disconnect();
            done(performance.now() - start);
          }
        });
        observer.observe(button, { attributes: true, attributeFilter: ["aria-pressed"] });
      });
      button.click();
      return reacted;
    });
    lines.push(`| Coche d'une tâche (réaction visible) | ${Math.round(check)} ms | ${OPTIMISTIC_LIMIT_MS} ms |`);
    expect(check).toBeGreaterThanOrEqual(0);
    expect(check).toBeLessThan(OPTIMISTIC_LIMIT_MS);

    // ⌘K (Ctrl+K) : le champ de la palette prend le focus, prêt à saisir.
    const palette = await page.evaluate(async () => {
      const start = performance.now();
      const focused = new Promise<number>((done) => {
        const poll = () => (document.activeElement?.getAttribute("role") === "combobox" ? done(performance.now() - start) : requestAnimationFrame(poll));
        requestAnimationFrame(poll);
      });
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
      return focused;
    });
    lines.push(`| ⌘K : la palette prête à saisir | ${Math.round(palette)} ms | ${GESTURE_LIMIT_MS} ms |`);
    expect(palette).toBeLessThan(GESTURE_LIMIT_MS);
  } finally {
    await context.close();
  }
});

test("NFR-02, HUB-12 — 95 % des requêtes des parcours P0 en moins de 300 ms ; la recherche en moins de 500 ms", async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({ storageState: session, locale: "fr-FR" });
  const coupleContext = await browser.newContext({ storageState: coupleSession, locale: "fr-FR" });
  try {
    const request = context.request;
    const planner = ["/", "/taches", `/events/${setup.eventId}`, `/events/${setup.eventId}?onglet=retroplanning`, `/budget/${setup.eventId}`, "/devis", "/contacts", `/jour-j/${setup.eventId}`];
    const urls: [typeof request, string][] = [...planner.map((url): [typeof request, string] => [request, url]), [coupleContext.request, "/portail"]];
    // Un premier passage réveille le serveur (connexions, caches) ; il ne compte pas.
    for (const [client, url] of urls) await client.get(url);
    // Lot 65 (décision de Julien du 22/11/2026, ADR 0078) : trois séries ; le seuil vaut pour la
    // médiane de leurs 95e centiles. Une série seule, sur une machine de CI partagée, variait de 212 à
    // 343 ms d'une version à l'autre, sur main comme ailleurs.
    const pageSeries: number[] = [];
    const searchSeries: number[] = [];
    let pageCount = 0;
    let searchCount = 0;
    for (let series = 0; series < SERIES; series += 1) {
      const pages: number[] = [];
      for (let round = 0; round < 8; round += 1) {
        for (const [client, url] of urls) {
          const start = performance.now();
          const response = await client.get(url);
          await response.body();
          pages.push(performance.now() - start);
          expect(response.status(), url).toBe(200);
        }
      }
      const searches: number[] = [];
      for (const query of ["Inès", "Sacha", "traiteur", "Salon", "lieu", "plan de table", "Inès Sacha", "photographe", "faire-part", "dégustation"]) {
        for (let round = 0; round < 2; round += 1) {
          const start = performance.now();
          const response = await request.get(`/recherche/instantanee?q=${encodeURIComponent(query)}`);
          await response.body();
          searches.push(performance.now() - start);
          expect(response.status(), query).toBe(200);
        }
      }
      pageSeries.push(Math.round(percentile(pages, 95)));
      searchSeries.push(Math.round(percentile(searches, 95)));
      pageCount = pages.length;
      searchCount = searches.length;
    }
    const pagesP95 = median(pageSeries);
    const searchP95 = median(searchSeries);
    lines.push(`| Serveur : pages des parcours P0, médiane des 95e centiles de ${SERIES} séries (${pageCount} requêtes chacune : ${pageSeries.join(", ")} ms) | ${pagesP95} ms | ${SERVER_P95_LIMIT_MS} ms |`);
    lines.push(`| Serveur : recherche, médiane des 95e centiles de ${SERIES} séries (${searchCount} requêtes chacune : ${searchSeries.join(", ")} ms) | ${searchP95} ms | ${SEARCH_P95_LIMIT_MS} ms |`);
    expect(pagesP95).toBeLessThan(SERVER_P95_LIMIT_MS);
    expect(searchP95).toBeLessThan(SEARCH_P95_LIMIT_MS);
  } finally {
    await context.close();
    await coupleContext.close();
  }
});
