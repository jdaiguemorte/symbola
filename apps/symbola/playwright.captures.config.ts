// Lot 13 (AIDE-12, ADR 0033) — captures réelles du centre d'aide :
// `pnpm --filter @symbola/app help:captures`, socle de dev démarré (comme les
// parcours e2e). Écrit public/aide/captures/<écran>.jpg ; à relancer à chaque
// lot qui modifie un écran, puis relire les images dans la PR.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./captures",
  testMatch: "*.captures.ts",
  workers: 1,
  timeout: 300_000,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    // Les repères ne s'ouvrent pas d'eux-mêmes : le script les ouvre là où il faut.
    storageState: {
      cookies: [{ name: "symbola_visites_auto", value: "0", domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }],
      origins: [],
    },
  },
  webServer: {
    command: process.env.E2E_SERVER_COMMAND ?? "pnpm dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
