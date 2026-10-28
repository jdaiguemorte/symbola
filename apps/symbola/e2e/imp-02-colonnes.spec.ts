// IMP-02 — étape « colonnes » : chaque colonne reçoit une proposition avec un
// indice de confiance ; une proposition sous le seuil n'est enregistrée
// qu'une fois confirmée. En taille ordinateur et en 375 px, axe-core sur
// chaque écran.
import { randomUUID } from "node:crypto";
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

test("IMP-02 — propositions de colonnes, confirmation d'une colonne à faible confiance", async ({ page }) => {
  const email = `planner-imp02-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-imp02-e2e";
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
    buffer: Buffer.from("Intitulé;Unité;Montant\nCoordination jour J;forfait;1 500,00\nHeure supplémentaire;heure;75,00\n", "utf-8"),
  });
  await page.getByRole("button", { name: "Lire le fichier" }).click();
  await page.getByRole("link", { name: "Continuer : reconnaître les colonnes" }).click();

  await expect(page.getByRole("heading", { name: "Colonnes de « tarifs.csv »" })).toBeVisible();
  const amount = page.getByRole("group", { name: "Montant" });
  await expect(amount).toContainText("Exemples : 1 500,00 · 75,00");
  await expect(amount).toContainText("confiance faible, à confirmer");
  await expect(page.getByRole("group", { name: "Intitulé" })).toContainText("Proposition : Intitulé (confiance 100 %)");
  await expectNoAxeViolation(page);

  // Sans confirmation, la colonne à faible confiance n'est pas appliquée.
  await page.getByRole("button", { name: "Enregistrer les colonnes" }).click();
  await expect(page.getByText("Les colonnes n'ont pas été enregistrées :")).toBeVisible();
  await expect(page.getByText("colonne « Montant » : confirmez la correspondance avec « Prix unitaire HT »")).toBeVisible();
  await expectNoAxeViolation(page);

  await amount.getByLabel("Je confirme : cette colonne correspond à « Prix unitaire HT »").check();
  await page.getByRole("button", { name: "Enregistrer les colonnes" }).click();
  await expect(page.getByText("3 colonnes associées, aucune sans équivalent, aucune ignorée.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifier les correspondances des colonnes" })).toBeVisible();
  await expectNoAxeViolation(page);
});
