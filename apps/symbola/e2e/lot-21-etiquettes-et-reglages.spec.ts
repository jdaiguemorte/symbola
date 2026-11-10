// Lot 21 — étiquettes prêtes à l'emploi et écrans de réglage simplifiés
// (retours de recette du lot 20, Julien, 10/11/2026). Corrections directes :
// pastilles sur toute la largeur de la fiche (PRE-20), menu des réglages qui
// défile seul (HUB-28). En taille ordinateur et en 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { createVendor, createVendorTag, createVendorType } from "../modules/vendors/service";
import { readyOrganization } from "./helpers";

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

test("PRE-20 — les pastilles d'étiquettes prennent toute la largeur de la fiche", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `planner-lot21-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot21-e2e";
  const { sql, db } = createAppConnection();
  let vendorId: string;
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    for (const label of ["Anglais", "Bougies", "Champêtre"]) await createVendorTag(organization.id, label);
    vendorId = (await createVendor(organization.id, { name: "Fleurs de Lys", typeId: null, city: "Lille" })).vendor.id;
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  for (const path of [`/prestataires/${vendorId}`, "/prestataires/nouveau"]) {
    await page.goto(path);
    const chips = page.locator(".tag-chips .tag-chip");
    await expect(chips).toHaveCount(3);
    // Des pastilles courtes se suivent sur une ligne : même hauteur à l'écran
    // (les trois en taille ordinateur, les deux premières en 375 px).
    const boxes = await Promise.all([0, 1, 2].map(async (i) => (await chips.nth(i).boundingBox())!));
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThanOrEqual(1);
    if (page.viewportSize()!.width >= 1024) expect(Math.abs(boxes[0]!.y - boxes[2]!.y)).toBeLessThanOrEqual(1);
    // La rangée de pastilles occupe la largeur du bloc Étiquettes.
    const block = (await page.locator(".tag-fieldset").boundingBox())!;
    const row = (await page.locator(".tag-chips").first().boundingBox())!;
    expect(row.width).toBeGreaterThan(block.width * 0.8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await expectNoAxeViolation(page);
});

test("HUB-28 — le menu des réglages défile seul, sans faire défiler l'écran", async ({ page }) => {
  test.setTimeout(90_000);
  // Le menu est collé à gauche de l'écran seulement en taille ordinateur ;
  // en 375 px il passe au-dessus du contenu et défile avec la page.
  test.skip(page.viewportSize()!.width < 1024, "menu latéral en taille ordinateur");
  const email = `planner-lot21-nav-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-lot21-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    // Un écran de réglage plus long que la fenêtre.
    for (let i = 1; i <= 30; i += 1) await createVendorType(organization.id, `Type de prestataire ${i}`, "#4f6b5a");
  } finally {
    await sql.end();
  }
  await page.setViewportSize({ width: 1280, height: 640 });
  await loginAndSetupMfa(page, email, password);
  await page.goto("/prestataires/parametres");

  const nav = page.getByRole("navigation", { name: "Rubriques des paramètres" });
  await expect(nav).toBeVisible();
  const sizes = await nav.evaluate((element) => ({ scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }));
  expect(sizes.scrollHeight).toBeGreaterThan(sizes.clientHeight);

  const box = (await nav.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => nav.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  // La dernière rubrique devient visible sans aller au bas de l'écran.
  await page.mouse.wheel(0, 2000);
  await expect(nav.getByRole("link").last()).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
});
