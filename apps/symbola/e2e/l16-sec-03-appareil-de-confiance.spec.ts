// L16-SEC-03 (lot 16, ADR 0038) — appareil de confiance : la planner coche « se
// souvenir de cet appareil », se reconnecte sans code, puis « oublie ses
// appareils » depuis son profil : le code est de nouveau demandé. En taille
// ordinateur et en 375 px, avec axe-core. Un compte neuf par exécution.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { logout, readyOrganization } from "./helpers";

const PASSWORD = "mot-de-passe-e2e-de-test";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

async function signOut(page: Page) {
  await logout(page);
  await expect(page).toHaveURL(/\/login$/);
}

async function expectNoAxeViolation(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test("L16-SEC-03 — un appareil retenu dispense du code pendant 90 jours, jusqu'à ce que la planner l'oublie", async ({ page }) => {
  const email = `sec03-e2e-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Organisation L16-SEC-03 ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" });
  } finally {
    await sql.end();
  }

  // Première connexion : configuration, et « se souvenir de cet appareil ».
  await signIn(page, email);
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  const remember = page.getByLabel("Se souvenir de cet appareil pendant 90 jours");
  await expect(remember).not.toBeChecked();
  await remember.check();
  await expectNoAxeViolation(page);
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");

  // Connexion suivante sur cet appareil : pas de code.
  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL("/");

  // Profil : un appareil de confiance, qu'elle oublie.
  await page.goto("/profil");
  await expect(page.getByText("1 appareil de confiance")).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Oublier tous mes appareils" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Vos appareils de confiance sont oubliés" })).toBeVisible();

  // Le code est de nouveau demandé.
  await signOut(page);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/mfa$/);
});
