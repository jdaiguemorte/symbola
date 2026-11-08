// HUB-19 (lot 16, ADR 0039) — le « ? » est dans la barre du haut, au même
// endroit sur tous les écrans de l'équipe ; l'aide s'ouvre dans un tiroir qui
// ne recouvre pas le contenu (ordinateur) ; fermée, elle rend le focus au « ? ».
// En taille ordinateur et en 375 px, avec axe-core. Un compte neuf par exécution.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { landmarksPanel, readyOrganization } from "./helpers";

const PASSWORD = "mot-de-passe-e2e-de-test";
// Dix écrans représentatifs : à repères, sans repères, réglages (menu des rubriques).
const SCREENS = ["/", "/events", "/taches", "/prestataires", "/devis", "/devis/catalogue", "/parametres", "/import", "/profil", "/rgpd"];

async function signIn(page: Page) {
  const email = `hub19-e2e-${randomUUID()}@symbola.test`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Organisation HUB-19 ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password: PASSWORD, role: "owner" });
  } finally {
    await sql.end();
  }
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
  const uri = await page.locator("code").textContent();
  const secret = new URL(uri!.replace("otpauth://totp/", "https://x/")).searchParams.get("secret")!;
  await page.getByLabel("Code").fill(new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate());
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL("/");
}

test("HUB-19 — le « ? » au même endroit sur tous les écrans, un tiroir qui ne recouvre pas l'écran", async ({ page }) => {
  await signIn(page);

  const positions: { screen: string; x: number; y: number }[] = [];
  for (const screen of SCREENS) {
    await page.goto(screen);
    const help = page.getByRole("button", { name: "Aide sur cet écran" });
    await expect(help).toBeVisible();
    // Un seul « ? » par écran, dans la barre du haut.
    await expect(page.locator(".help-button")).toHaveCount(1);
    await expect(page.locator(".app-topbar").getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
    const box = (await help.boundingBox())!;
    positions.push({ screen, x: Math.round(box.x), y: Math.round(box.y) });
  }
  const [first] = positions;
  for (const position of positions) {
    expect(Math.abs(position.x - first!.x), `${position.screen} : ${position.x} au lieu de ${first!.x}`).toBeLessThanOrEqual(1);
    expect(Math.abs(position.y - first!.y), `${position.screen} : ${position.y} au lieu de ${first!.y}`).toBeLessThanOrEqual(1);
  }

  // L'aide de l'écran s'ouvre dans un tiroir ; sur ordinateur, le contenu se décale au lieu d'être recouvert.
  await page.goto("/taches");
  const help = page.getByRole("button", { name: "Aide sur cet écran" });
  await help.click();
  await expect(help).toHaveAttribute("aria-expanded", "true");
  const panel = landmarksPanel(page, "Les tâches de tous vos mariages");
  await expect(panel).toBeVisible();
  const viewport = page.viewportSize()!;
  if (viewport.width >= 1024) {
    const panelBox = (await panel.boundingBox())!;
    const mainBox = (await page.locator(".app-main").boundingBox())!;
    expect(mainBox.x + mainBox.width).toBeLessThanOrEqual(panelBox.x + 1);
  }
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  // Échap ferme l'aide et rend le focus au « ? ».
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeFocused();
});
