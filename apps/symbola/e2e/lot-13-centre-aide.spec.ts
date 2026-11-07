// Lot 13 (AIDE-12, AIDE-13) — centre d'aide par écran : vignettes groupées
// par rubrique avec la capture réelle de l'écran, fiche d'un écran (capture
// annotée, repères, questions fréquentes), recherche dans l'aide ; chaque
// public ne voit que ses écrans. Ordinateur et 375 px, axe-core.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { landmarksPanel, readyOrganization } from "./helpers";

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
  await expect(page).not.toHaveURL(/\/mfa$/);
}

async function account(role: "owner" | "member" | "admin") {
  const email = `aide-centre-${role}-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-centre-aide";
  const { sql, db } = createAppConnection();
  try {
    const organizationId = role === "admin" ? null : (await readyOrganization(db, `Org ${randomUUID()}`)).id;
    await createUser(db, { organizationId, email, password, role });
  } finally {
    await sql.end();
  }
  return { email, password };
}

test("AIDE-12 — une vignette par écran avec sa capture, une fiche avec capture annotée, repères et questions", async ({ page }) => {
  const owner = await account("owner");
  await login(page, owner.email, owner.password);

  await page.goto("/aide");
  const events = page.getByRole("region", { name: "Événements" });
  const tile = events.getByRole("link", { name: /Fiche de l'événement/ });
  await expect(tile).toBeVisible();
  await expect(tile.locator("img")).toHaveAttribute("src", "/aide/captures/eventsDetail.jpg");
  await expect(page.getByRole("region", { name: "Devis et factures" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Import et données personnelles" }).getByRole("link", { name: /Données personnelles/ })).toBeVisible();
  await expectNoAxeViolation(page);

  // La recherche porte aussi sur les questions fréquentes.
  await page.getByLabel("Rechercher dans l'aide").fill("perdu");
  await expect(tile).toBeVisible();
  await expect(events.getByRole("link", { name: /Modèles de rétroplanning/ })).toHaveCount(0);
  await page.getByLabel("Rechercher dans l'aide").fill("");

  await tile.click();
  await expect(page).toHaveURL(/\/aide\/ecrans\/eventsDetail$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Aide : Fiche de l'événement");
  const capture = page.getByRole("img", { name: "Capture de l'écran « Fiche de l'événement », avec ses repères numérotés" });
  await expect(capture).toBeVisible();
  expect(await capture.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1280);
  await expect(page.getByRole("region", { name: "Les repères de cet écran" }).getByRole("listitem")).toHaveCount(5);
  await expect(page.getByText("Comment marquer un événement perdu ?")).toBeVisible();
  await expect(page.getByText("Cet écran s'ouvre depuis la fiche d'un événement.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Depuis la fiche d'un écran, ses repères s'ouvrent sur l'écran lui-même.
  await page.goto("/aide/ecrans/eventsList");
  await page.getByRole("link", { name: "Voir les repères sur l'écran" }).click();
  await expect(page).toHaveURL(/\/events\?visite=revoir$/);
  await expect(landmarksPanel(page, "Liste des événements")).toBeVisible();
});

test("AIDE-12 — chaque public ne voit que ses écrans", async ({ page }) => {
  const member = await account("member");
  await login(page, member.email, member.password);
  await page.goto("/aide");
  await expect(page.getByRole("link", { name: /Liste des événements/ })).toBeVisible();
  // Les données personnelles sont réservées à la titulaire.
  await expect(page.getByRole("link", { name: /Données personnelles/ })).toHaveCount(0);
  const response = await page.goto("/aide/ecrans/privacySearch");
  expect(response?.status()).toBe(404);
});

test("AIDE-12 — l'Admin ne voit que l'aide de la console, sans capture d'organisation", async ({ page }) => {
  const admin = await account("admin");
  await login(page, admin.email, admin.password);
  await page.goto("/aide");
  const console = page.getByRole("region", { name: "Administration de la suite" });
  await expect(console.getByRole("link", { name: /Comptes et assistance/ })).toBeVisible();
  await expect(console.locator("img")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Événements" })).toHaveCount(0);
  await expectNoAxeViolation(page);
  const response = await page.goto("/aide/ecrans/eventsList");
  expect(response?.status()).toBe(404);
});
