// AIDE-01/02 — module événements : visite guidée à la première ouverture,
// relançable depuis « ? », puis essai guidé sur un mariage fictif,
// supprimé à la fin de l'essai. En taille ordinateur et en 375 px,
// axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";

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

test("AIDE-01/02 — visite guidée du module événements, puis essai guidé supprimé à la fin", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `planner-aide-evt-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-aide-evt-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // AIDE-01 : la visite s'ouvre à la première ouverture du module.
  await page.goto("/events");
  await page.waitForLoadState("networkidle");
  const tour = page.getByRole("dialog");
  await expect(tour).toHaveAccessibleName("Vos événements");
  await expectNoAxeViolation(page);
  await tour.getByRole("button", { name: "Suivant" }).click();
  await expect(tour).toHaveAccessibleName("Créer un prospect");
  await tour.getByRole("button", { name: "Passer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Déjà vue : elle ne se rouvre plus d'elle-même, mais se relance depuis « ? ».
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Liste des événements").first().click();
  await page.getByRole("button", { name: "Relancer la visite guidée" }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Vos événements");
  await page.getByRole("dialog").getByRole("button", { name: "Passer" }).click();

  // AIDE-02 : l'essai ouvre un mariage fictif complet, marqué comme tel.
  await page.getByRole("button", { name: "Démarrer l'essai" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  const trialUrl = page.url();
  const trialId = trialUrl.split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Essai guidé — données fictives" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Camille & Sacha");
  await expect(page.getByText("Pendant l'essai, aucune invitation n'est envoyée")).toBeVisible();
  await expect(page.getByRole("button", { name: "Inviter le marié" })).toHaveCount(0);
  await expectNoAxeViolation(page);

  // Une vraie opération sur les données fictives.
  await page.waitForLoadState("networkidle");
  await page.locator("select[name=toStatus]").selectOption("confirmed");
  await page.getByRole("button", { name: "Changer le statut" }).click();
  await expect(page.getByText("Statut mis à jour.")).toBeVisible();
  const pdf = await page.request.get(`/events/${trialId}/programme/pdf?variant=couple`);
  expect(pdf.status()).toBe(200);

  await page.goto("/events");
  await expect(page.getByRole("link", { name: /Camille & Sacha/ })).toContainText("Essai (fictif)");
  await expect(page.getByRole("link", { name: "Reprendre l'essai en cours" })).toBeVisible();

  // Fin de l'essai : toutes ses données disparaissent.
  await page.goto(trialUrl);
  await page.getByRole("button", { name: "Terminer l'essai et supprimer ses données" }).click();
  await expect(page).toHaveURL(/\/events\?essai=termine$/);
  await expect(page.getByText("Essai terminé : ses données fictives ont été supprimées.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Camille & Sacha/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Démarrer l'essai" })).toBeVisible();
  await page.goto(trialUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
  await expectNoAxeViolation(page);
});
