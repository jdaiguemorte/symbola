// SOC-09/CLAUDE.md §6-7 : au moins un parcours par story, en taille
// ordinateur et en 375 px (mobile). Nécessite le socle de dev (Postgres,
// Garage, ClamAV) démarré — docker-compose.dev.yml.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // En CI, un parcours à la fois : sous charge (fournisseur d'identité sur le
  // même runner, délai de 2 s des vérifications de la page Santé), les
  // parcours en parallèle se gênent sur un runner de 4 cœurs. Depuis le
  // lot 33, chaque connexion passe par le lien, Mailpit et Logto : 28 min
  // environ en série (timeout-minutes du job e2e : 45).
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
  ],
  // En CI : la version compilée (`next build`), démarrée par
  // E2E_SERVER_COMMAND avec NODE_ENV=test, qui autorise le faux fournisseur
  // de signature (interdit en production) ; en local : `pnpm dev`.
  webServer: {
    command: process.env.E2E_SERVER_COMMAND ?? "pnpm dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
