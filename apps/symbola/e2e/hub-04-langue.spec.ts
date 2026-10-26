// HUB-04 — « La langue par défaut est celle du navigateur. » « Quand il
// choisit FR ou EN dans son profil, toutes les apps s'affichent dans
// cette langue. » « Un test en CI échoue si une clé manque » est couvert
// par packages/i18n (pnpm check:messages), pas ici.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test } from "@playwright/test";
import * as OTPAuth from "otpauth";

test.describe("HUB-04 — Langue par défaut du navigateur", () => {
  test.use({ locale: "en-US" });

  test("un navigateur en anglais affiche /login en anglais", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    const violations = await new AxeBuilder({ page }).analyze();
    expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);
  });
});

test("HUB-04-02 — choisir une langue dans le profil s'applique à toute l'app", async ({ page }) => {
  const email = `langue-e2e-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-langue-e2e";

  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }

  // Connexion en français (contexte par défaut, fr-FR).
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const provisioningUri = await page.locator("code").textContent();
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();

  // Passe en anglais depuis le profil.
  await page.getByRole("link", { name: "Mon profil" }).click();
  await expect(page.getByRole("heading", { name: "Mon profil" })).toBeVisible();
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await page.getByLabel("Langue").selectOption("en");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Preferences saved.")).toBeVisible();

  // Toute l'app suit désormais l'anglais — vérifié sur un autre écran.
  await page.goto("/");
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});
