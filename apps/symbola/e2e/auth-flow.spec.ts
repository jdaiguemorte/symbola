// SOC-04 — Parcours de connexion + MFA + accueil, en taille ordinateur et
// en 375 px (CLAUDE.md §6-7), avec vérification d'accessibilité (axe-core)
// sur chaque écran. Utilisateur de test créé directement en base (mêmes
// fonctions que packages/auth/scripts/seed-demo-user.ts), isolé par un
// e-mail unique par exécution.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { openMenu, readyOrganization } from "./helpers";

const email = `playwright-e2e-${randomUUID()}@symbola.test`;
const password = "mot-de-passe-e2e-de-test";

test.beforeAll(async () => {
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, "Organisation E2E Playwright");
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
});

test("EVT-E2E-01 — connexion, configuration MFA, puis accueil", async ({ page }) => {
  await page.goto("/login");
  let violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/mfa$/);
  violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  // ADR 0028 : QR code à scanner et clé lisible pour une saisie à la main.
  await expect(page.getByRole("img", { name: "QR code à scanner avec votre application d'authentification" })).toBeVisible();
  await expect(page.locator(".totp-secret")).toHaveText(/^([A-Z2-7]{4} )+[A-Z2-7]{1,4}$/);
  const provisioningUri = await page.locator("code").textContent();
  expect(provisioningUri).toBeTruthy();
  // Partir sans valider de code ne bloque pas : l'écran réaffiche la même clé.
  await page.reload();
  await expect(page.locator("code")).toHaveText(provisioningUri!);
  const secret = new URL(provisioningUri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret");
  expect(secret).toBeTruthy();
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret!) });

  await page.getByLabel("Code").fill(totp.generate());
  await page.getByRole("button", { name: "Valider" }).click();

  await expect(page).toHaveURL("/");
  await openMenu(page);
  await expect(page.getByText(`Connecté comme ${email}`)).toBeVisible();
  await expect(page.getByText("Bonjour depuis Symbola")).toBeVisible();
  violations = await new AxeBuilder({ page }).analyze();
  expect(violations.violations, JSON.stringify(violations.violations, null, 2)).toEqual([]);

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
