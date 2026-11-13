// Lot 18 — retours de la recette du lot 17 (Julien, 09/11/2026) : un seul lien
// du menu allumé (L18-HUB-22), pastille « Reprendre » sur Tutoriels seulement
// (L18-HUB-23), « Plus d'options » sans déformer la barre (L18-HUB-24), estimation des
// trajets expliquée (L18-PRE-16), en-tête de l'agenda aligné (L20-HUB-25, recette du
// 10/11). En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { recordHelpProgress } from "../modules/hub/service";
import { mainMenu, openMenu, readyOrganization } from "./helpers";

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

test("Lot 18 — menu, « Plus d'options », pastille des tutoriels et estimation des trajets", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `planner-lot18-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot18-e2e";
  const { sql, db } = createAppConnection();
  let userId: string;
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    userId = (await createUser(db, { organizationId: organization.id, email, password, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // L20-HUB-25 (recette du 10/11) : dans l'en-tête de l'agenda, « ‹ Aujourd'hui › »
  // est centré sur le sélecteur de durée quand ils partagent une ligne ; en
  // 375 px, la navigation passe au-dessus, sans chevauchement.
  // Lot 32a (D3) : l'agenda est passé sur « Évènements ».
  await page.goto("/events");
  const navigation = (await page.getByRole("navigation", { name: "Naviguer dans l'agenda" }).boundingBox())!;
  const spans = (await page.getByRole("navigation", { name: "Durée affichée" }).boundingBox())!;
  if (page.viewportSize()!.width >= 768) {
    expect(Math.abs(navigation.y + navigation.height / 2 - (spans.y + spans.height / 2))).toBeLessThanOrEqual(1);
  } else {
    expect(navigation.y + navigation.height).toBeLessThanOrEqual(spans.y);
  }

  // L18-HUB-22 : sur Encaissements, seul « Encaissements » est allumé.
  await page.goto("/devis/encaissements");
  await openMenu(page);
  await expect(mainMenu(page).getByRole("link", { name: "Encaissements", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(mainMenu(page).getByRole("link", { name: "Devis et factures", exact: true })).not.toHaveAttribute("aria-current", "page");

  // L18-HUB-24, revu au lot 20 (décision 2) : plus de « Plus d'options » ; la
  // barre des Événements ne garde que « Nouveau prospect ».
  await page.goto("/events");
  await expect(page.getByRole("link", { name: "Nouveau prospect" })).toBeVisible();
  await expect(page.getByText("Plus d'options")).toHaveCount(0);

  // L18-HUB-23 : un tutoriel en cours ; la pastille « Reprendre » n'apparaît que sur Tutoriels.
  const { sql: sql2, db: db2 } = createAppConnection();
  try {
    await recordHelpProgress(db2, { userId, itemKey: "tutorial:day-program", status: "started", step: 1 });
  } finally {
    await sql2.end();
  }
  const resume = page.getByRole("link", { name: /^Reprendre : / });
  await page.goto("/events");
  await expect(page.getByRole("heading", { level: 1, name: "Événements" })).toBeVisible();
  await expect(resume).toHaveCount(0);
  await page.goto("/tutoriels");
  await expect(resume).toBeVisible();

  // L18-PRE-16 : l'écran dit où sert l'estimation et en montre un exemple, recalculé à la saisie.
  await page.goto("/prestataires/parametres/trajet");
  await expect(page.getByRole("heading", { level: 1, name: "Estimation des trajets" })).toBeVisible();
  await expect(page.getByText(/autour d'un lieu/)).toBeVisible();
  await expect(page.getByText(/40 km à vol d'oiseau → environ 52 km de route, ≈ 52 min/)).toBeVisible();
  await page.getByLabel(/Coefficient de détour/).fill("2");
  await expect(page.getByText(/40 km à vol d'oiseau → environ 80 km de route, ≈ 80 min/)).toBeVisible();
  await expectNoAxeViolation(page);
});
