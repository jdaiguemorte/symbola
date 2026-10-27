// ONB-01/02 — questionnaire d'onboarding interruptible/reprenable,
// changement de régime de TVA daté, seuils de franchise Admin.
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
}

test("ONB-01-01 — le bandeau guide vers la fiche entreprise incomplète, sans bloquer l'accès", async ({ page }) => {
  const email = `titulaire-onb-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-onb-e2e";

  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, email, password);
  // L'accueil reste accessible : aucune redirection forcée (PRD : ne
  // jamais bloquer l'entrée dans la plateforme).
  await expect(page.getByText("Votre fiche entreprise n'est pas encore complète.")).toBeVisible();

  await page.getByRole("link", { name: "La compléter" }).click();
  await expect(page).toHaveURL(/\/parametres$/);
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);
});

test("ONB-01-02 — chaque étape sauvegardée survit à une interruption, et le bandeau disparaît une fois complet", async ({
  page,
}) => {
  const email = `titulaire-onb2-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-onb-e2e";

  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, email, password);
  await page.goto("/parametres");

  // Étape 1, puis « interruption » (on quitte la page).
  await page.getByLabel("SIREN").fill("123456789");
  await page.getByLabel("Forme juridique").selectOption("sasu");
  await page.getByLabel("Métier").selectOption("wedding_planner");
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await expect(page.getByText("Fiche entreprise enregistrée.")).toBeVisible();

  await page.goto("/");
  // Toujours incomplet : le régime de TVA manque encore.
  await expect(page.getByText("Votre fiche entreprise n'est pas encore complète.")).toBeVisible();

  // Reprend plus tard : le SIREN déjà saisi est toujours là.
  await page.goto("/parametres");
  await expect(page.getByLabel("SIREN")).toHaveValue("123456789");

  await page.getByLabel("Date d'effet").fill("2027-01-01");
  await page.getByRole("button", { name: "Changer de régime" }).click();
  await expect(page.getByText("Régime de TVA mis à jour.")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Votre fiche entreprise n'est pas encore complète.")).toHaveCount(0);
});

test("ONB-02-01 — l'Admin fixe les seuils de franchise, jamais codés en dur", async ({ page }) => {
  const adminEmail = `admin-onb-${randomUUID()}@symbola.test`;
  const adminPassword = "mot-de-passe-admin-onb-e2e";

  const { sql, db } = createAppConnection();
  try {
    await createUser(db, { organizationId: null, email: adminEmail, password: adminPassword, role: "admin" });
  } finally {
    await sql.end();
  }

  await loginAndSetupMfa(page, adminEmail, adminPassword);
  await page.goto("/admin/parametres");
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await page.getByLabel("Seuil de franchise — prestations de services (€)").fill("37500");
  await page.getByLabel("Seuil de franchise — vente de marchandises (€)").fill("85000");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Seuil de franchise — prestations de services (€)")).toHaveValue("37500");
});
