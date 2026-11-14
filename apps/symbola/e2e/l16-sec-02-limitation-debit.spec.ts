// Lot 16 (L16-SEC-02, ADR 0044) — limitation de débit : depuis une même adresse IP, la
// vingt et unième demande de lien de connexion du quart d'heure est refusée, avec un message qui
// dit combien de minutes attendre (lot 33 : le lien remplace le mot de passe oublié). Ordinateur
// et 375 px, axe-core. L'adresse du client est celle que le proxy pose dans X-Forwarded-For ; le
// test la choisit, propre à chaque passage.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("L16-SEC-02 — au-delà de 20 demandes de lien par adresse IP en un quart d'heure, un message dit combien de minutes attendre", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `203.0.113.${Math.floor(Math.random() * 250) + 1}-${randomUUID().slice(0, 8)}` });

  async function askForLink() {
    await page.goto("/login");
    await page.getByLabel("Adresse e-mail").fill(`inconnu-${randomUUID()}@symbola.test`);
    await page.getByRole("button", { name: "Recevoir un lien de connexion" }).click();
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await askForLink();
    await expect(page.getByRole("status")).toContainText("Un lien de connexion vient de partir");
  }

  await askForLink();
  // Le message de l'écran (Next ajoute son propre role="alert", l'annonceur de route).
  await expect(page.locator("main").getByRole("alert")).toHaveText("Trop de tentatives. Réessayez dans 15 minutes.");
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
});
