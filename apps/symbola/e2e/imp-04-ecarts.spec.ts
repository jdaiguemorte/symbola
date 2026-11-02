// IMP-04 — rapport des écarts : une colonne sans équivalent est gardée en
// champ libre, les lignes rejetées sont listées avec leur motif et se
// téléchargent en CSV. En taille ordinateur et en 375 px, axe-core sur chaque
// écran.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
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

test("IMP-04 — colonne gardée en champ libre, lignes rejetées et leur CSV", async ({ page }) => {
  const email = `planner-imp04-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-imp04-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  await page.goto("/import");
  await page.getByLabel("Articles du catalogue").check();
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles({
    name: "tarifs.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Intitulé;Unité;Prix HT;Remarque\nFleurs;bouquet;85;de saison\nDJ;;950;\nPhoto;jour;abc;\n", "utf-8"),
  });
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await page.getByRole("link", { name: "Continuer : reconnaître les colonnes" }).click();
  await page.getByRole("button", { name: "Enregistrer les colonnes" }).click();
  await page.getByRole("link", { name: "Continuer : rapprocher des éléments existants" }).click();
  await page.getByRole("link", { name: "Continuer : rapport des écarts" }).click();

  await expect(page.getByRole("heading", { name: "Rapport des écarts de « tarifs.csv »" })).toBeVisible();
  const remark = page.getByRole("group", { name: "Remarque" });
  await expect(remark).toContainText("Exemples : de saison");
  await expect(remark).toContainText("À décider.");
  await expect(page.getByText("Ligne 3 : Unité : champ obligatoire manquant")).toBeVisible();
  await expect(page.getByText("Ligne 4 : Prix unitaire HT : montant invalide (abc)")).toBeVisible();
  await expect(page.getByText("2 lignes sur 3 ne seront pas importées.", { exact: false })).toBeVisible();
  await expectNoAxeViolation(page);

  await remark.getByLabel("Garder en champ libre sur la fiche").check();
  await page.getByRole("button", { name: "Enregistrer les choix" }).click();
  await expect(remark).not.toContainText("À décider.");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Télécharger les lignes rejetées (CSV)" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tarifs-lignes-rejetees.csv");
  const csv = readFileSync((await download.path())!, "utf-8");
  expect(csv).toBe(
    "﻿Motif du rejet;Intitulé;Unité;Prix HT;Remarque\r\n" +
      "Unité : champ obligatoire manquant;DJ;;950;\r\n" +
      "Prix unitaire HT : montant invalide (abc);Photo;jour;abc;\r\n",
  );

  await page.getByRole("link", { name: "Retour à l'import" }).click();
  await expect(page.getByText("1 colonne gardée en champ libre, aucune ignorée.")).toBeVisible();
  await expectNoAxeViolation(page);
});
