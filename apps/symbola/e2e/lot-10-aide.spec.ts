// Lot 10 (AIDE-05, AIDE-07) — visite focus de la fiche d'un événement :
// « Continuer », « Plus tard » qui garde l'étape, reprise depuis la barre
// d'aide, Échap ; centre d'aide (progression, état des visites, préférence
// d'ouverture automatique). En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { createProspect, createProspectSource } from "../modules/events/service";
import { clickMenuLink } from "./helpers";
import { recordHelpProgress } from "../modules/hub/service";

// Visites ouvertes d'office : sans la préférence posée par la configuration.
test.use({ storageState: { cookies: [], origins: [] } });

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

test("AIDE-05/07 — visite focus mise de côté puis reprise, et centre d'aide", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `planner-aide-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  let eventId: string;
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const user = await createUser(db, { organizationId: organization.id, email, password: "mot-de-passe-aide-lot10", role: "owner" });
    const source = await createProspectSource(organization.id, "Salon");
    eventId = (await createProspect({ organizationId: organization.id, createdByUserId: user.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }] })).id;
  } finally {
    await sql.end();
  }

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-aide-lot10");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
  // La visite de l'accueil s'ouvre d'elle-même ; on la met de côté.
  await page.getByRole("dialog", { name: "Bienvenue sur Symbola" }).getByRole("button", { name: "Plus tard" }).click();

  // Fiche d'un événement : visite focus, étape 1 sur 5, « Continuer » mis en avant.
  await page.goto(`/events/${eventId}`);
  const tour = page.getByRole("dialog");
  await expect(tour).toHaveAccessibleName("La fiche d'un événement");
  await expect(tour).toContainText("Étape 1 sur 5");
  await expect(tour.getByRole("button", { name: "Continuer" })).toBeFocused();
  await expectNoAxeViolation(page);
  await tour.getByRole("button", { name: "Continuer" }).click();
  await expect(tour).toHaveAccessibleName("Vue d'ensemble");
  await tour.getByRole("button", { name: "Plus tard" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // La barre d'aide propose de reprendre à l'étape 2 ; Échap la remet de côté.
  const bar = page.getByRole("complementary", { name: "Barre d'aide" });
  await bar.getByRole("button", { name: "Reprendre la visite (étape 2)" }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Vue d'ensemble");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Rechargée, la fiche ne rouvre pas la visite d'elle-même.
  await page.reload();
  await expect(page.getByRole("button", { name: "Reprendre la visite (étape 2)" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Centre d'aide : progression, état de la visite, préférence.
  await clickMenuLink(page, "Aide");
  await expect(page.getByRole("heading", { name: "Votre prise en main : 0 sur 9" })).toBeVisible();
  const events = page.getByRole("region", { name: "Événements" });
  await expect(events.getByRole("listitem").filter({ hasText: "Visite : La fiche d'un événement" })).toContainText("Mise de côté · étape 2");
  await expectNoAxeViolation(page);
  await page.getByLabel("Ouvrir les visites automatiquement à la première ouverture d'un écran").uncheck();
  await expect
    .poll(async () => (await page.context().cookies()).find((cookie) => cookie.name === "symbola_visites_auto")?.value)
    .toBe("0");
  await page.goto("/events");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Événements");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("HUB-05 — l'Admin voit la prise en main de chaque compte d'équipe", async ({ page }) => {
  const adminEmail = `admin-suivi-${randomUUID()}@symbola.test`;
  const ownerEmail = `titulaire-suivi-${randomUUID()}@symbola.test`;
  const organizationName = `Organisation suivi ${randomUUID().slice(0, 8)}`;
  const { sql, db } = createAppConnection();
  try {
    await createUser(db, { organizationId: null, email: adminEmail, password: "mot-de-passe-admin-suivi", role: "admin" });
    const organization = await createOrganization(db, organizationName);
    const owner = await createUser(db, { organizationId: organization.id, email: ownerEmail, password: "mot-de-passe-titulaire", role: "owner" });
    await recordHelpProgress(db, { userId: owner.id, itemKey: "tutorial:catalog", status: "completed", step: 3 });
    await recordHelpProgress(db, { userId: owner.id, itemKey: "tutorial:retroplanning-template", status: "postponed", step: 1 });
  } finally {
    await sql.end();
  }

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(adminEmail);
  await page.getByLabel("Mot de passe").fill("mot-de-passe-admin-suivi");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("dialog", { name: "Bienvenue sur Symbola" }).getByRole("button", { name: "Plus tard" }).click();

  await page.goto("/admin");
  await page.getByRole("link", { name: "Prise en main" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Prise en main des organisations");
  const row = page.getByRole("row", { name: new RegExp(ownerEmail) });
  await expect(row).toContainText("1 sur 9");
  await expect(row).toContainText("Saisir son catalogue de prestations");
  await expect(row).toContainText("À quoi sert un modèle de rétroplanning ? · étape 2");
  await expectNoAxeViolation(page);
});
