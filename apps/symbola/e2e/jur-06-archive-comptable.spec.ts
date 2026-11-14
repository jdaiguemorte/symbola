// Lot 23b — JUR-06 et FAC-14 : archive comptable de la titulaire (décision D7),
// vérification de l'intégrité de la chaîne des pièces ; un collaborateur n'y a
// pas accès. Taille ordinateur et 375 px (projets de playwright.config.ts),
// axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { expect, test, type Page } from "@playwright/test";
import { readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function organizationWith(role: "owner" | "member") {
  const email = `${role}-jur06-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-e2e-de-test";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role });
  } finally {
    await sql.end();
  }
  return { email, password };
}

test("JUR-06 — la titulaire ouvre son archive comptable et vérifie l'intégrité de la chaîne", async ({ page }) => {
  const owner = await organizationWith("owner");
  await loginAndSetupMfa(page, owner.email, owner.password);
  await page.goto("/devis/parametres/archive");
  await expect(page.getByRole("heading", { level: 1, name: "Archive comptable" })).toBeVisible();
  await expect(page.getByText("Aucune facture, aucun avoir ni encaissement pour l'instant.")).toBeVisible();
  await expectNoAxeViolation(page);
  await page.getByRole("button", { name: "Vérifier l'intégrité" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Chaîne intacte" })).toBeVisible();
  await expectNoAxeViolation(page);
});

test("JUR-06 — un collaborateur n'a pas accès à l'archive comptable", async ({ page }) => {
  const member = await organizationWith("member");
  await loginAndSetupMfa(page, member.email, member.password);
  await page.goto("/devis/parametres/archive");
  await expect(page.getByText("L'archive comptable est réservée à la titulaire du compte.")).toBeVisible();
  await expectNoAxeViolation(page);
});
