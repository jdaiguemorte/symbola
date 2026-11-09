// Lot 13 (AIDE-10) — page Tutoriels en parcours : tuiles par étape, suivant
// conseillé, un seul tutoriel en cours (terminer d'abord ou abandonner).
// Ordinateur et 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { recordHelpProgress } from "../modules/hub/service";
import { clickMenuLink, readyOrganization } from "./helpers";

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

test("AIDE-10 — parcours des tutoriels, un seul en cours à la fois", async ({ page }) => {
  const email = `planner-tuto-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-tutoriels";
  const { sql, db } = createAppConnection();
  let userId: string;
  try {
    const organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    userId = (await createUser(db, { organizationId, email, password, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  await login(page, email, password);

  // Une page à part, au menu, avec le parcours en étapes.
  await clickMenuLink(page, "Tutoriels");
  await expect(page).toHaveURL(/\/tutoriels$/);
  await expect(page.getByRole("heading", { name: "Tutoriels faits : 0 sur 11" })).toBeVisible();
  const activity = page.getByRole("region", { name: "Préparer votre activité" });
  // Lot 18 (AIDE-13) : personnaliser ses documents est conseillé en premier.
  await expect(activity.getByRole("link", { name: /Personnaliser vos devis et factures/ })).toContainText("Conseillé ensuite");
  await expect(page.getByRole("region", { name: "Autres tutoriels" })).toContainText("Importer ses événements existants");
  await expectNoAxeViolation(page);

  // Un tutoriel en cours : il est mis en avant, et en commencer un autre demande de choisir.
  const { sql: sql2, db: db2 } = createAppConnection();
  try {
    await recordHelpProgress(db2, { userId, itemKey: "tutorial:day-program", status: "started", step: 1 });
  } finally {
    await sql2.end();
  }
  await page.reload();
  await expect(page.getByText("En cours : Préparer le programme du jour J (étape 2)")).toBeVisible();
  await page.getByRole("link", { name: /Saisir son catalogue de prestations/ }).click();
  const conflict = page.getByRole("alertdialog", { name: "Un tutoriel est déjà en cours" });
  await expect(conflict).toBeVisible();
  await expectNoAxeViolation(page);
  await expect(conflict.getByRole("link", { name: "Le terminer d’abord" })).toHaveAttribute("href", "/aide/tutoriels/day-program");
  await conflict.getByRole("button", { name: "L’abandonner et commencer celui-ci" }).click();
  await expect(page).toHaveURL(/\/aide\/tutoriels\/catalog$/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Saisir son catalogue de prestations" })).toBeVisible();

  await page.goto("/tutoriels");
  await expect(page.getByText(/En cours :/)).toHaveCount(0);
});
