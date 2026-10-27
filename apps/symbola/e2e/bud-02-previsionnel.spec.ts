// BUD-02 — confirmer la simulation en budget prévu depuis la fiche
// événement, tableau prévu/réel/écart, modification du réel à la main.
// En taille ordinateur et en 375 px, axe-core sur chaque écran.
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

test("BUD-02 — confirmer la simulation en budget prévu, puis suivre prévu/réel/écart", async ({ page }) => {
  const email = `planner-bud02-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-bud02-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Prérequis : postes par défaut, source, modèle de répartition.
  // Attend l'hydratation et chaque confirmation : un clic trop tôt part
  // sans effet (course déjà rencontrée au lot 2, EVT-03).
  await page.goto("/events/parametres");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Lieu de réception" })).toBeVisible();
  await page.getByLabel("Nouvelle source").fill("Instagram");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();

  await page.goto("/budget/parametres");
  await page.waitForLoadState("networkidle");
  // AIDE-01 : première ouverture du module, la visite guidée s'affiche.
  await page.getByRole("dialog").getByRole("button", { name: "Passer" }).click();
  await page.getByLabel("Nom du modèle").fill("Classique");
  await page.getByLabel("Lieu de réception %").fill("60");
  await page.getByLabel("Traiteur %").fill("40");
  await page.getByRole("button", { name: "Créer le modèle" }).click();
  await expect(page.getByText("Modèle créé.")).toBeVisible();

  // Prospect, simulation.
  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Camille");
  await page.getByLabel("Source du prospect").selectOption({ label: "Instagram" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page.getByRole("heading", { name: "Camille" })).toBeVisible();
  const eventUrl = page.url();

  await page.getByRole("link", { name: "Budget" }).click();
  await page.getByLabel("Budget total (€)").fill("10000");
  await page.getByLabel("Nombre d'invités").fill("40");
  await page.getByLabel("Modèle de répartition").selectOption({ label: "Classique" });
  await page.getByRole("button", { name: "Simuler" }).click();
  await expect(page.getByText("250,00 €", { exact: false })).toBeVisible();

  // Pas encore de bandeau avant confirmation (événement toujours prospect).
  await page.goto(eventUrl);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Faire de la simulation le budget prévu" })).toHaveCount(0);

  // Passage en Confirmé → le bandeau apparaît.
  await page.locator('select[name="toStatus"]').selectOption("confirmed");
  await page.getByRole("button", { name: "Changer le statut" }).click();
  await expect(page.getByRole("heading", { name: "Faire de la simulation le budget prévu" })).toBeVisible();
  await expectNoAxeViolation(page);

  await page.getByRole("button", { name: "En faire le budget prévu" }).click();
  await expect(page.getByRole("heading", { name: "Faire de la simulation le budget prévu" })).toHaveCount(0);

  // BUD-02 : tableau prévu/réel/écart.
  await page.goto(`${eventUrl}`.replace("/events/", "/budget/"));
  await expectNoAxeViolation(page);
  const table = page.getByRole("table", { name: "Prévu, réel, écart" });
  await expect(table).toBeVisible();
  const lieuRow = table.getByRole("row", { name: /Lieu de réception/ });
  await expect(lieuRow).toContainText("6 000,00 €");
  await expect(lieuRow).toContainText("Non renseigné");

  // Modification du réel à la main, écart calculé (6000 € prévu, 7000 € réel).
  await lieuRow.getByLabel(/Réel —/).fill("7000");
  await lieuRow.getByRole("button", { name: "Mettre à jour le réel" }).click();
  await expect(lieuRow).toContainText("Dépassement de 1 000,00 €");
  await expectNoAxeViolation(page);
});
