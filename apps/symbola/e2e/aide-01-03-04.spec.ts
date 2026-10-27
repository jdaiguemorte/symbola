// AIDE-01 — « Une visite guidée courte montre les fonctions principales,
// écran par écran. Il peut la passer. Elle se relance à tout moment depuis
// le bouton « ? » du module. »
// AIDE-03 — « Chaque écran a un bouton « ? » qui ouvre un article court sur
// ce que l'on peut y faire. L'aide est consultable et cherchable depuis le
// hub. »
// AIDE-04 — « Le tableau de bord affiche une liste des premiers pas. Il
// peut la masquer. »
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

async function loginAndSetupMfa(page: Page, email: string, password: string): Promise<void> {
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

async function createTestUser(): Promise<{ email: string; password: string }> {
  const email = `aide-e2e-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-aide-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org Aide ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  return { email, password };
}

test("AIDE-01/03/04 — visite guidée, aide et liste premiers pas sur l'accueil", async ({ page }) => {
  const { email, password } = await createTestUser();
  await loginAndSetupMfa(page, email, password);

  // AIDE-01 : la visite s'affiche automatiquement à la première ouverture.
  const tour = page.getByRole("dialog", { name: "Bienvenue sur Symbola" });
  await expect(tour).toBeVisible();
  let violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByRole("dialog", { name: "Complétez votre fiche entreprise" })).toBeVisible();
  await page.getByRole("button", { name: "Suivant" }).click();
  await expect(page.getByRole("dialog", { name: "De l'aide à tout moment" })).toBeVisible();
  await page.getByRole("button", { name: "Terminer" }).click();
  await expect(tour).toBeHidden();

  // La visite déjà vue ne se réaffiche pas automatiquement.
  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();

  // AIDE-03 : le bouton « ? » ouvre un article, avec un lien pour relancer
  // la visite.
  await page.locator('summary[aria-label="Tableau de bord"]').click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await page.getByRole("button", { name: "Relancer la visite guidée" }).click();
  await expect(page.getByRole("dialog", { name: "Bienvenue sur Symbola" })).toBeVisible();
  await page.getByRole("button", { name: "Passer" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // AIDE-04 : la liste « premiers pas » peut être masquée, et le reste.
  await expect(page.getByRole("heading", { name: "Premiers pas" })).toBeVisible();
  await expect(page.getByText("Compléter la fiche entreprise")).toBeVisible();
  await page.getByRole("button", { name: "Masquer cette liste" }).click();
  await expect(page.getByRole("heading", { name: "Premiers pas" })).toBeHidden();
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Premiers pas" })).toBeHidden();

  // AIDE-03 : l'aide est consultable et cherchable depuis le hub.
  await page.getByRole("link", { name: "Aide", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Aide", level: 1 })).toBeVisible();
  violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible();
  await page.getByLabel("Rechercher dans l'aide").fill("TVA");
  await expect(page.getByRole("heading", { name: "Paramètres", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Paramètres de la plateforme" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Administration" })).toBeHidden();

  await page.getByLabel("Rechercher dans l'aide").fill("xyznotfound");
  await expect(page.getByText("Aucun article ne correspond à votre recherche.")).toBeVisible();
});
