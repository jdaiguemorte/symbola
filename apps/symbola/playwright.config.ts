// SOC-09/CLAUDE.md §6-7 : au moins un parcours par story, en taille
// ordinateur et en 375 px (mobile). Nécessite le socle de dev (Postgres,
// Garage, ClamAV) démarré — docker-compose.dev.yml.
import { defineConfig, devices } from "@playwright/test";
import { fileGrep, SOCLE_GREP } from "./e2e/socle";

// Lot 76 (ADR 0124) : la CI en deux vitesses choisit les parcours par trois variables.
// - E2E_SOCLE=1 : le socle (e2e/socle.ts) ;
// - E2E_FICHIERS : en plus, des fichiers de parcours en entier (noms séparés par des espaces) ;
// - E2E_SANS_MESURES=1 : la suite sans les mesures du temps de réponse (NFR-01, NFR-02), jouées
//   dans leur propre job de CI, à place fixe et serveur chaud.
const extraFiles = (process.env.E2E_FICHIERS ?? "").split(/\s+/).filter(Boolean);
const selection = [...(process.env.E2E_SOCLE === "1" ? SOCLE_GREP : []), ...fileGrep(extraFiles)];

// Lot 40c (NFR-18, NFR-19 ; décisions D17, D18 ; ADR 0078) : les parcours des scénarios du cahier des
// charges tournent aussi sous Firefox et WebKit (moteur de Safari), à 360 et à 1 920 px ; SC-10 est
// joué à 150 % (fenêtre de 1 280 × 800 réduite d'autant). Le reste de la suite reste sous Chromium,
// qui couvre aussi Edge.
const SCENARIO_SPECS = /(sc-01-sc-10-demarrage|hub-08-sc-03-lundi-matin|hub-14-sc-10-contacts|fac-01-07-devis-complet|fac-04-05-contrat|por-02-05-portail-client|jrj-01-03-mode-jour-j|jrj-04-documents-embarques|ux-09-nfr-16-saisie|imp-09-reprise)\.spec\.ts$/;
const SC10_SPECS = /(sc-01-sc-10-demarrage|hub-14-sc-10-contacts)\.spec\.ts$/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  ...(selection.length > 0 ? { grep: selection } : {}),
  ...(process.env.E2E_SANS_MESURES === "1" ? { testIgnore: /nfr-01-02-mesures\.spec\.ts$/ } : {}),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // En CI, un parcours à la fois : sous charge (fournisseur d'identité sur le
  // même runner, délai de 2 s des vérifications de la page Santé), les
  // parcours en parallèle se gênent sur un runner de 4 cœurs. Depuis le
  // lot 33, chaque connexion passe par le lien, Mailpit et Logto. Lot 76 : la
  // suite complète (74 min en série) se joue en quatre parts sur main.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // PRD-HUB-04 : la langue par défaut suit celle du navigateur. Les
    // parcours existants attendent du français ; un test dédié vérifie
    // le changement de langue avec un contexte en anglais.
    locale: "fr-FR",
    // Lot 10 : préférence « ne pas ouvrir les visites automatiquement »
    // (centre d'aide), pour que les visites focus ne masquent pas les écrans
    // des autres parcours ; les parcours de l'aide la retirent.
    storageState: {
      cookies: [{ name: "symbola_visites_auto", value: "0", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }],
      origins: [],
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-375",
      use: { viewport: { width: 375, height: 812 } },
    },
    { name: "firefox", testMatch: SCENARIO_SPECS, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", testMatch: SCENARIO_SPECS, use: { ...devices["Desktop Safari"] } },
    { name: "mobile-360", testMatch: SCENARIO_SPECS, use: { viewport: { width: 360, height: 780 } } },
    { name: "desktop-1920", testMatch: SCENARIO_SPECS, use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } } },
    { name: "zoom-150", testMatch: SC10_SPECS, use: { ...devices["Desktop Chrome"], viewport: { width: 853, height: 533 } } },
  ],
  // En CI : la version compilée (`next build`), démarrée par
  // E2E_SERVER_COMMAND avec NODE_ENV=test, qui autorise le faux fournisseur
  // de signature (interdit en production) ; en local : `pnpm dev`.
  webServer: {
    command: process.env.E2E_SERVER_COMMAND ?? "pnpm dev",
    url: "http://localhost:3000/login",
    // Lot 76 : le job des mesures démarre le serveur lui-même et le garde entre le réchauffement et
    // les mesures (E2E_SERVEUR_PARTAGE=1).
    reuseExistingServer: !process.env.CI || process.env.E2E_SERVEUR_PARTAGE === "1",
    timeout: 60_000,
  },
});
