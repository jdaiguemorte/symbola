// PRD-HUB-04 — « La langue par défaut est celle du navigateur. » « Quand il
// choisit FR ou EN dans son profil, toutes les apps s'affichent dans
// cette langue. » « Un test en CI échoue si une clé manque » est couvert
// par packages/i18n (pnpm check:messages), pas ici.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test } from "@playwright/test";
import { openMenu, openSettingsTab, readyOrganization, signIn as signInByLink } from "./helpers";

test.describe("PRD-HUB-04 — Langue par défaut du navigateur", () => {
  test.use({ locale: "en-US" });

  test("un navigateur en anglais affiche /login en anglais", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    const violations = await new AxeBuilder({ page }).analyze();
    expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);
  });
});

test("PRD-HUB-04-02 — choisir une langue dans le profil s'applique à toute l'app", async ({ page }) => {
  const email = `langue-e2e-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-langue-e2e";

  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }

  // Connexion en français (contexte par défaut, fr-FR).
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email);
  await expect(page).toHaveURL("/");
  await openMenu(page);
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();

  // Passe en anglais depuis le profil.
  await openSettingsTab(page, "Mon compte");
  await expect(page.getByRole("heading", { name: "Mon profil" })).toBeVisible();
  const violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await page.getByLabel("Langue").selectOption("en");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Preferences saved.")).toBeVisible();

  // Toute l'app suit désormais l'anglais — vérifié sur un autre écran.
  await page.goto("/");
  await openMenu(page);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
});
