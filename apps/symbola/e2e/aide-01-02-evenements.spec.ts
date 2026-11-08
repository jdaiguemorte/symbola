// AIDE-11/02 — module événements : repères affichés à la première ouverture,
// rouverts depuis « ? », puis essai guidé sur un mariage fictif,
// supprimé à la fin de l'essai. En taille ordinateur et en 375 px,
// axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { changeEventStatus, closeLandmarks, landmarksPanel, openEventTab, readyOrganization } from "./helpers";

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

// Repères ouverts d'office (sans la préférence posée par la
// configuration des autres parcours).
test.use({ storageState: { cookies: [], origins: [] } });

test("AIDE-11/02 — repères du module événements, puis essai guidé supprimé à la fin", async ({ page }) => {
  test.setTimeout(90_000);
  const email = `planner-aide-evt-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-aide-evt-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // AIDE-11 : les repères s'affichent d'office à la première ouverture.
  await page.goto("/events");
  const panel = landmarksPanel(page, "Liste des événements");
  await expect(panel.getByRole("heading", { name: "La liste", level: 3 })).toBeVisible();
  await expectNoAxeViolation(page);
  await panel.getByRole("button", { name: "Nouveau prospect" }).click();
  await expect(panel.getByRole("heading", { name: "Nouveau prospect", level: 3 })).toBeVisible();
  await closeLandmarks(page, "Liste des événements");

  // Déjà vus : ils ne se rouvrent plus d'eux-mêmes, mais depuis « ? ».
  await page.reload();
  await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "Aide sur cet écran" }).click();
  await closeLandmarks(page, "Liste des événements");

  // AIDE-02 : l'essai ouvre un mariage fictif complet, marqué comme tel.
  // Lot 16 (HUB-20) : l'essai est dans « ⋯ Plus d'options ».
  await page.getByText("⋯ Plus d'options").click();
  await page.getByRole("button", { name: "Démarrer l'essai" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  // Les repères de la fiche s'affichent d'eux-mêmes ; ce parcours les ferme.
  await closeLandmarks(page, "Fiche de l'événement");
  const trialUrl = page.url();
  const trialId = trialUrl.split("/").pop()!;
  await expect(page.getByRole("heading", { name: "Essai guidé — données fictives" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Camille & Sacha");
  await openEventTab(page, "Mariés");
  await expect(page.getByText("Pendant l'essai, aucune invitation n'est envoyée")).toBeVisible();
  await expect(page.getByRole("button", { name: "Inviter le marié" })).toHaveCount(0);
  await expectNoAxeViolation(page);

  // Une vraie opération sur les données fictives.
  await openEventTab(page, "Vue d'ensemble");
  await page.waitForLoadState("networkidle");
  await changeEventStatus(page, "Confirmé");
  await expect(page.getByText("Statut mis à jour.")).toBeVisible();
  const pdf = await page.request.get(`/events/${trialId}/programme/pdf?variant=couple`);
  expect(pdf.status()).toBe(200);

  await page.goto("/events");
  await expect(page.getByRole("row", { name: /Camille & Sacha/ })).toContainText("Essai (fictif)");
  await expect(page.getByRole("link", { name: "Reprendre l'essai en cours" })).toBeVisible();

  // Fin de l'essai : toutes ses données disparaissent.
  await page.goto(trialUrl);
  await page.getByRole("button", { name: "Terminer l'essai et supprimer ses données" }).click();
  await expect(page).toHaveURL(/\/events\?essai=termine$/);
  await expect(page.getByText("Essai terminé : ses données fictives ont été supprimées.")).toBeVisible();
  await expect(page.getByRole("row", { name: /Camille & Sacha/ })).toHaveCount(0);
  await page.getByText("⋯ Plus d'options").click();
  await expect(page.getByRole("button", { name: "Démarrer l'essai" })).toBeVisible();
  await page.goto(trialUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
  await expectNoAxeViolation(page);
});
