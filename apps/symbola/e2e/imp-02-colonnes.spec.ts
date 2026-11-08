// IMP-02 — étape « colonnes » : chaque colonne reçoit une proposition avec un
// indice de confiance ; une proposition sous le seuil n'est enregistrée
// qu'une fois confirmée. En taille ordinateur et en 375 px, axe-core sur
// chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { readyOrganization } from "./helpers";

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
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  await page.goto("/import");
  // Lot 16 (IMP-11) : « Un autre fichier », puis le contenu.
  await page.getByRole("navigation", { name: "Que voulez-vous reprendre ?" }).getByRole("link", { name: /Un autre fichier/ }).click();
  await page.getByLabel("Articles du catalogue").check();
  await page.getByLabel("Fichier (CSV, Excel .xlsx ou JSON)").setInputFiles({
    name: "tarifs.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Intitulé;Unité;Montant\nCoordination jour J;forfait;1 500,00\nHeure supplémentaire;heure;75,00\n", "utf-8"),
  });
  await page.getByRole("button", { name: "Lire le fichier" }).click();

  // Seule la colonne à faible confiance est à décider ; les autres se résument.
  await expect(page).toHaveURL(/\/colonnes$/);
  await expect(page.getByRole("heading", { name: "Import de « tarifs.csv »" })).toBeVisible();
  const toDecide = page.getByRole("region", { name: "Colonnes à décider" });
  const amount = toDecide.getByRole("row").filter({ hasText: "Montant" });
  await expect(amount).toContainText("1 500,00 · 75,00");
  await expect(amount).toContainText("Prix unitaire HT ? (");
  await expect(amount).toContainText("à confirmer");
  await expect(page.getByRole("heading", { name: "2 colonnes reconnues" })).toBeVisible();
  await expectNoAxeViolation(page);

  // Sans confirmation, la colonne à faible confiance n'est pas appliquée : rien n'est choisi d'office.
  const continueButton = page.getByRole("group", { name: "Actions de l'étape" }).getByRole("button", { name: "Continuer" });
  await continueButton.click();
  await expect(page).toHaveURL(/\/colonnes$/);
  await expect(toDecide.getByLabel("Champ pour la colonne « Montant »")).toHaveValue("");

  await toDecide.getByLabel("Champ pour la colonne « Montant »").selectOption({ label: "Prix unitaire HT (obligatoire)" });
  await continueButton.click();
  await expect(page).not.toHaveURL(/\/colonnes$/);
  await expect(page.getByRole("navigation", { name: "Étapes de l'import" }).getByRole("listitem").filter({ hasText: "Colonnes" })).toContainText("3 colonnes reconnues");
  await expectNoAxeViolation(page);
});
