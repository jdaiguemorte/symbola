// Lot 13 (L13-PRE-12) — carnet de prestataires : types en pastilles avec leur
// nombre, liste et carte côte à côte (bascule sur téléphone), fiche dans le
// panneau latéral. Géocodeur simulé, pas de fond de carte installé.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { createVendor } from "../modules/vendors/service";
import { readyOrganization } from "./helpers";

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

test("L13-PRE-12 — liste et carte côte à côte, fiche dans le panneau latéral", async ({ page }) => {
  const email = `planner-carnet-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-carnet";
  const { sql, db } = createAppConnection();
  let organizationId: string;
  try {
    organizationId = (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    await createUser(db, { organizationId, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await createVendor(organizationId, { name: "Maison Verdier", typeId: null, city: "Lille", phone: "03 20 00 00 00" });
  await createVendor(organizationId, { name: "Studio Lumière", typeId: null, city: "Arras" });
  await login(page, email, password);

  await page.goto("/prestataires");
  // Lot 16 (L16-PRE-14) : pastilles par famille ; ces fiches sans type sont « à classer ».
  await expect(page.getByRole("navigation", { name: "Familles de prestataires" }).getByRole("link", { name: "Tous · 2" })).toBeVisible();
  const list = page.getByRole("region", { name: /^\d+ résultats?/ });
  await expect(list.getByRole("link", { name: "Maison Verdier" })).toBeVisible();

  // Sur ordinateur, liste et carte ensemble ; sur téléphone, l'une ou l'autre.
  const map = page.getByRole("region", { name: /Carte : 2 prestataires placés/ });
  if (page.viewportSize()!.width >= 1024) {
    await expect(map).toBeVisible();
  } else {
    await expect(map).toBeHidden();
    await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Carte" }).click();
    await expect(map).toBeVisible();
    await expect(list).toBeHidden();
    await page.getByRole("navigation", { name: "Affichage" }).getByRole("link", { name: "Liste" }).click();
    await expect(list).toBeVisible();
    await expect(page).not.toHaveURL(/vue=carte/);
  }

  // La fiche s'ouvre dans le panneau ; la recherche reste en place.
  await page.getByRole("search", { name: "Filtres du carnet" }).getByLabel("Nom ou ville").fill("verdier");
  await expect(page).toHaveURL(/q=verdier/);
  await list.getByRole("link", { name: "Maison Verdier" }).click();
  const panel = page.getByRole("complementary", { name: "Maison Verdier" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("03 20 00 00 00");
  await expect(panel.getByRole("link", { name: "Ouvrir la fiche complète" })).toBeVisible();
  await expect(page).toHaveURL(/q=verdier/);
  await expectNoAxeViolation(page);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page).toHaveURL(/q=verdier/);
  await expect(page).not.toHaveURL(/fiche=/);
});
