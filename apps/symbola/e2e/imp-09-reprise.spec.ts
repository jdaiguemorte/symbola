// Lot 14d (IMP-09) — la page « Importer » présente d'abord les deux reprises
// depuis l'outil actuel (prestataires, fiches événement), avec la façon
// d'obtenir le fichier ; une carte présélectionne son type d'import ; la
// fiche d'exemple (PDF fictif) se télécharge et s'importe. En taille
// ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { openSettingsTab, readyOrganization } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Lot 15 (IMP-10) : les fiches sont lues en tâche de fond ; la page montre
// l'avancement puis ouvre d'elle-même les rapprochements (ou, si la lecture
// était déjà finie à l'affichage, propose le lien).
async function waitForSheetsRead(page: Page) {
  await expect(page.getByText("Lecture des fiches").first()).toBeVisible();
  const next = page.getByRole("link", { name: "Continuer : rapprocher des éléments existants" });
  await expect.poll(async () => page.url().endsWith("/rapprochements") || (await next.isVisible()), { timeout: 30_000 }).toBe(true);
  if (!page.url().endsWith("/rapprochements")) await next.click();
  await expect(page).toHaveURL(/\/rapprochements$/);
}

test("IMP-09 — les reprises depuis l'outil actuel en premier, avec une fiche d'exemple", async ({ page }) => {
  const email = `planner-imp09-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-imp09-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  await openSettingsTab(page, "Importer");
  const takeover = page.getByRole("region", { name: "Reprendre vos données depuis votre outil actuel" });
  await expect(takeover.getByRole("heading", { level: 3 })).toHaveText(["Reprendre mes prestataires", "Reprendre mes événements"]);
  await expect(takeover).toContainText("exportez-la au format Excel");
  await expect(takeover).toContainText("téléchargez sa fiche en PDF");
  // Dans la liste des types, les deux reprises viennent en premier.
  const types = page.getByRole("group", { name: "Que contient le fichier ?" }).getByRole("radio");
  await expect(types.nth(0)).toHaveAccessibleName("Prestataires du carnet (une ligne par prestataire)");
  await expect(types.nth(1)).toHaveAccessibleName("Fiches événement (PDF, une fiche par événement)");
  await expectNoAxeViolation(page);

  // La carte des prestataires présélectionne son type.
  await takeover.getByRole("link", { name: "Importer mes prestataires" }).click();
  await expect(page.getByLabel("Prestataires du carnet (une ligne par prestataire)")).toBeChecked();
  await expect(page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)")).toBeVisible();

  // La fiche d'exemple : un PDF fictif, téléchargé puis importé.
  const link = takeover.getByRole("link", { name: "Télécharger une fiche d'exemple (PDF fictif) pour essayer" });
  const response = await page.request.get((await link.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  await takeover.getByRole("link", { name: "Importer mes fiches événement" }).click();
  await expect(page.getByLabel("Fiches événement (PDF, une fiche par événement)")).toBeChecked();
  await page.getByLabel("Fiches événement (PDF, une ou plusieurs)").setInputFiles({ name: "fiche-evenement-exemple.pdf", mimeType: "application/pdf", buffer: await response.body() });
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await waitForSheetsRead(page);
  await expect(page.getByRole("heading", { name: /Ligne 1 : Léa MARTIN & Hugo BERNARD/ })).toBeVisible();
  await expectNoAxeViolation(page);
});
