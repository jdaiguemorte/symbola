// Lot 16 (SEC-02, ADR 0044) — limitation de débit : depuis une même adresse,
// la sixième demande de lien « mot de passe oublié » de l'heure est refusée,
// avec un message qui dit combien de minutes attendre. Ordinateur et 375 px,
// axe-core. L'adresse du client est celle que le proxy pose dans
// X-Forwarded-For ; le test la choisit, propre à chaque passage.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("SEC-02 — au-delà de 5 demandes de lien par adresse en une heure, un message dit combien de minutes attendre", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "X-Forwarded-For": `203.0.113.${Math.floor(Math.random() * 250) + 1}-${randomUUID().slice(0, 8)}` });

  async function askForLink() {
    await page.goto("/mot-de-passe-oublie");
    await page.getByLabel("E-mail").fill(`inconnu-${randomUUID()}@symbola.test`);
    await page.getByRole("button", { name: "Recevoir le lien" }).click();
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await askForLink();
    await expect(page.getByRole("status")).toContainText("Si un compte existe pour cette adresse");
  }

  await askForLink();
  await expect(page.getByRole("alert")).toHaveText("Trop de tentatives. Réessayez dans 60 minutes.");
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
});
