// Lot 71b (HUB-14 ; I6) : la page s'appelle « Reprendre et importer » ; la reprise d'un mariage a sa page.
// Lot 14d (IMP-09) — la page « Importer » présente d'abord les deux reprises
// depuis l'outil actuel (prestataires, fiches évènement), avec la façon
// d'obtenir le fichier ; une carte présélectionne son type d'import ; la
// fiche d'exemple (PDF fictif) se télécharge et s'importe. En taille
// ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "./axe";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { answerSheetQuestions, openSettingsTab, readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

// Lot 15 (IMP-10) : les fiches sont lues en tâche de fond. Lot 16 (IMP-11) :
// à la fin, l'assistant passe de lui-même à l'étape suivante.
async function waitForSheetsRead(page: Page) {
  // Lot 71c (C-64) : puis l'étape « Questions » (« Où en est-il ? »).
  await expect.poll(() => page.url().endsWith("/questions"), { timeout: 30_000 }).toBe(true);
}

test("IMP-09 — « Reprendre et importer » : trois boutons de même rang, la reprise d'un mariage renvoyée vers sa page, et une fiche d'exemple", async ({ page }) => {
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

  await openSettingsTab(page, "Reprendre et importer");
  // Lot 16 (IMP-11) : « Que voulez-vous reprendre ? » en tuiles. Lot 71b (HUB-14 ; I6, R18) : « Reprendre
  // et importer » garde ce qui n'est pas un mariage, en trois boutons de même rang, et renvoie la reprise
  // d'un mariage vers sa page.
  await expect(page.getByRole("heading", { level: 1, name: "Reprendre et importer" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Un mariage en cours ?" }).getByRole("link", { name: "Reprendre un mariage en cours" })).toHaveAttribute("href", "/reprise");
  const tiles = page.getByRole("navigation", { name: "Que voulez-vous importer ?" });
  await expect(tiles.getByRole("link")).toHaveCount(3);
  await expect(tiles.getByRole("link").nth(0)).toContainText("Des contacts");
  await expect(tiles.getByRole("link").nth(1)).toContainText("Un carnet de prestataires");
  await expect(tiles.getByRole("link").nth(2)).toContainText("Une autre liste");
  await expectNoAxeViolation(page);

  // Le carnet ouvre directement le dépôt du fichier, sans choix à faire.
  await tiles.getByRole("link", { name: /Un carnet de prestataires/ }).click();
  await expect(page.getByRole("region", { name: "Un carnet de prestataires" })).toContainText("exportez-la au format Excel");
  await expect(page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);

  // « Une autre liste » : le choix détaillé, sans le carnet.
  await tiles.getByRole("link", { name: /Une autre liste/ }).click();
  await expect(page.getByLabel("Prestataires du carnet (une ligne par prestataire)")).toHaveCount(0);
  await expect(page.getByLabel("Articles du catalogue")).toBeVisible();
  await expectNoAxeViolation(page);

  // La fiche d'exemple : un PDF fictif, téléchargé puis importé (le bouton « Reprendre et importer » de
  // l'écran des évènements règle l'import sur les fiches).
  await page.goto("/import?type=event_sheets#import-form");
  const sheets = page.getByRole("region", { name: "Fiches évènement (PDF, une fiche par évènement)" });
  await expect(sheets).toContainText("téléchargez sa fiche en PDF");
  const link = sheets.getByRole("link", { name: "Télécharger une fiche d'exemple (PDF fictif) pour essayer" });
  const response = await page.request.get((await link.getAttribute("href"))!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  await page.getByLabel("Fiches évènement (PDF, une ou plusieurs)").setInputFiles({ name: "fiche-evenement-exemple.pdf", mimeType: "application/pdf", buffer: await response.body() });
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await waitForSheetsRead(page);
  await answerSheetQuestions(page);
  await expect(page.getByLabel(/Ligne 1 : Léa MARTIN & Hugo BERNARD/)).toBeVisible();
  await expectNoAxeViolation(page);
});
