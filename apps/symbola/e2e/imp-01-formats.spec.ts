// IMP-01 — étape « fichier » de l'import : un CSV Excel français est lu
// (encodage, séparateur, en-tête reconnus, aperçu), un ancien .xls est
// refusé avec un message clair, l'import en cours s'abandonne et reste au
// journal. En taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

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

// Corpus d'import partagé (packages/testing/import-corpus), lu par son chemin :
// Playwright compile les specs en CommonJS, sans import.meta.
const CORPUS_DIR = join(__dirname, "../../../packages/testing/import-corpus/files");

function corpusFile(name: string, mimeType: string) {
  return { name, mimeType, buffer: readFileSync(join(CORPUS_DIR, name)) };
}

test("IMP-01 — un CSV Excel est lu, un .xls refusé, l'import en cours abandonné", async ({ page }) => {
  const email = `planner-imp01-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-imp01-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  await page.goto("/import");
  await expect(page.getByRole("heading", { name: "Importer des données" })).toBeVisible();
  await expect(page.getByText("Aucun import pour l'instant.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Un ancien fichier Excel est refusé avec un message qui dit quoi faire.
  await page.getByLabel("Événements et leurs clients (une ligne par événement)").check();
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles(corpusFile("libreoffice.xls", "application/vnd.ms-excel"));
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await expect(page.getByText("Ce format de fichier n'est pas accepté")).toContainText("ancien fichier Excel (.xls)");
  await expectNoAxeViolation(page);

  // Un CSV d'Excel français (Windows-1252, point-virgule) est reconnu.
  await page.getByLabel("Événements et leurs clients (une ligne par événement)").check();
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles(corpusFile("excel-fr-windows1252.csv", "text/csv"));
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await expect(page.getByRole("heading", { name: "Import de « excel-fr-windows1252.csv »" })).toBeVisible();
  await expect(page.getByText("Windows-1252 (Excel sous Windows)")).toBeVisible();
  await expect(page.getByText("point-virgule")).toBeVisible();
  await expect(page.getByText("ligne 1", { exact: true })).toBeVisible();
  await expect(page.getByText("3 lignes")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Prénom mariée" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Domaine des Œillets" })).toBeVisible();
  await expectNoAxeViolation(page);

  // Abandon : retour au journal, l'import y figure comme abandonné.
  await page.getByRole("button", { name: "Abandonner l'import" }).click();
  await expect(page).toHaveURL(/\/import$/);
  const entry = page.getByRole("row").filter({ hasText: "excel-fr-windows1252.csv" });
  await expect(entry).toContainText("abandonné");
  await expect(entry.getByRole("link")).toHaveCount(0);
  await expectNoAxeViolation(page);
});
