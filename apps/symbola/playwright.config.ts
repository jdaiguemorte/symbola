// SOC-09/CLAUDE.md §6-7 : au moins un parcours par story, en taille
// ordinateur et en 375 px (mobile). Nécessite le socle de dev (Postgres,
// Garage, ClamAV) démarré — docker-compose.dev.yml.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
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
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
