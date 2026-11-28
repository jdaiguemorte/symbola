// HUB-09, HUB-18, HUB-23, UX-04 (lot 63f, ADR 0103 ; maquette M1) — assistant « L'essentiel » :
// six étapes, une question par écran, après le questionnaire d'accueil. Chaque étape s'enregistre
// (Entrée ou « Continuer ») dans les réglages existants ; rien n'est bloquant pour avancer
// (SC-01) ; une valeur mal formée est refusée sans perdre la saisie ; « Finir plus tard » ramène à
// l'accueil ; la fin aussi. En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { createUser } from "@symbola/auth";
import { completeSetup } from "../modules/hub/service";
import { signIn as signInByLink } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Une organisation qui vient de finir le questionnaire : ni SIRET, ni adresse, ni RIB.
async function freshOwner(page: Page) {
  const email = `essentiel-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org essentiel ${randomUUID().slice(0, 8)}`);
    await completeSetup(db, organization.id);
    await createUser(db, { organizationId: organization.id, email, role: "owner" });
  } finally {
    await sql.end();
  }
  await signInByLink(page, email);
}

test("HUB-09 / HUB-18 / HUB-23 — « L'essentiel » : six questions, une par écran, écrites dans les réglages", async ({ page }) => {
  test.setTimeout(120_000);
  await freshOwner(page);

  await page.goto("/demarrage/essentiel");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("L'essentiel");
  const steps = page.getByRole("navigation", { name: "Étapes de L'essentiel" });
  await expect(steps.getByRole("listitem")).toHaveCount(6);
  await expect(page.getByText("Étape 1 sur 6")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comment s'appelle votre société ?" })).toBeVisible();
  await expect(page.getByText("* obligatoire pour envoyer un devis")).toBeVisible();
  // Obligatoires pour envoyer un devis, jamais pour avancer : aucun champ n'est « required ».
  await expect(page.locator("form#essentials-form [required]")).toHaveCount(0);
  await expectNoAxeViolation(page);
  // Les étapes défilent dans leur ligne : jamais de défilement horizontal de l'écran (375 px).
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // Un SIRET mal formé est refusé, l'erreur nomme le champ, la saisie reste.
  await page.getByLabel("Raison sociale").fill("Atelier Lumière");
  await page.getByLabel("SIRET").fill("123");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.locator("#essentials-form").getByRole("alert")).toContainText("SIRET");
  await expect(page.getByLabel("Raison sociale")).toHaveValue("Atelier Lumière");
  await expect(page.getByLabel("SIRET")).toHaveAttribute("aria-invalid", "true");
  // Entrée enregistre et ouvre la question suivante.
  await page.getByLabel("SIRET").fill("732 829 320 00074");
  await page.getByLabel("SIRET").press("Enter");
  await expect(page.getByText("Étape 2 sur 6")).toBeVisible();
  await expect(steps.getByRole("listitem").first()).toHaveAttribute("data-state", "done");

  // Adresse et contact.
  await expect(page.getByRole("heading", { name: "Où vos clients vous écrivent-ils ?" })).toBeVisible();
  await page.getByLabel("Adresse").fill("12 rue des Tilleuls");
  await page.getByLabel("Code postal").fill("69002");
  await page.getByLabel("Ville").fill("Lyon");
  await page.getByLabel("E-mail professionnel").fill("contact@atelier.example");
  await page.getByRole("button", { name: "Continuer" }).click();

  // Logo : rien d'obligatoire, on passe.
  await expect(page.getByText("Étape 3 sur 6")).toBeVisible();
  await page.getByRole("button", { name: "Passer cette étape" }).click();

  // TVA : la réponse du questionnaire est choisie ; on confirme la franchise.
  await expect(page.getByText("Étape 4 sur 6")).toBeVisible();
  await page.getByRole("radio", { name: /Franchise en base/ }).check();
  await page.getByRole("button", { name: "Continuer" }).click();

  // Banque : un IBAN faux est refusé ; « Passer » n'écrit rien.
  await expect(page.getByText("Étape 5 sur 6")).toBeVisible();
  await page.getByLabel("IBAN").fill("FR00 1234");
  await page.getByRole("button", { name: "Continuer" }).click();
  await expect(page.locator("#essentials-form").getByRole("alert")).toContainText("IBAN");
  await page.getByRole("button", { name: "Passer cette étape" }).click();

  // Numérotation : l'exemple suit la saisie ; « Terminer » ramène à l'accueil.
  await expect(page.getByText("Étape 6 sur 6")).toBeVisible();
  await page.getByLabel("Préfixe des devis").fill("dv");
  await expect(page.getByText(/Premier devis de \d{4} : DV-\d{4}-0001/)).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Terminer" }).click();
  await expect(page).toHaveURL("/");

  // Les réponses sont dans les Paramètres, qui ne servent plus qu'à modifier ensuite.
  await page.goto("/parametres/entreprise");
  await expect(page.getByLabel("SIRET")).toHaveValue("73282932000074");
  await expect(page.getByLabel("Ville")).toHaveValue("Lyon");
  await page.goto("/devis/parametres");
  await expect(page.getByLabel(/Préfixe des devis/)).toHaveValue("DV");
});

test("HUB-09 — « Finir plus tard » enregistre l'étape affichée et ramène à l'accueil ; la reprise repart de là", async ({ page }) => {
  test.setTimeout(90_000);
  await freshOwner(page);
  await page.goto("/demarrage/essentiel");
  await page.getByLabel("Raison sociale").fill("Maison Bleue");
  await page.getByRole("button", { name: "Finir plus tard" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/demarrage/essentiel");
  // Sans SIRET, l'étape 1 n'est pas faite : on y revient, avec la raison sociale enregistrée.
  await expect(page.getByText("Étape 1 sur 6")).toBeVisible();
  await expect(page.getByLabel("Raison sociale")).toHaveValue("Maison Bleue");
  // Les étapes se parcourent librement : rien n'est bloquant.
  await page.getByRole("navigation", { name: "Étapes de L'essentiel" }).getByRole("link", { name: /TVA/ }).click();
  await expect(page.getByText("Étape 4 sur 6")).toBeVisible();
});
