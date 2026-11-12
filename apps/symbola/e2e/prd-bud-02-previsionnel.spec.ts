// PRD-BUD-02 — confirmer la simulation en budget estimé depuis la fiche
// événement, tableau des cinq montants et de l'écart, modification de l'engagé à la main.
// En taille ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { openEventTab, readyOrganization, changeEventStatus } from "./helpers";

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

test("PRD-BUD-02 — confirmer la simulation en budget estimé, puis suivre estimé/engagé/écart", async ({ page }) => {
  const email = `planner-bud02-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-bud02-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Prérequis : postes par défaut, source, modèle de répartition.
  // Attend l'hydratation et chaque confirmation : un clic trop tôt part
  // sans effet (course déjà rencontrée au lot 2, PRD-EVT-03).
  await page.goto("/events/parametres");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await expect(page.getByRole("rowheader", { name: "Lieu de réception" })).toBeVisible();
  // Lot 13 (L13-HUB-16) : les sources ont leur rubrique.
  await page.goto("/events/parametres/sources");
  await page.getByLabel("Nouvelle source").fill("Instagram");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();

  await page.goto("/budget/parametres");
  await page.waitForLoadState("networkidle");
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

  // Lot 12 (L12-EVT-17) : le budget est un onglet de la fiche ; le module
  // Budget s'ouvre depuis son lien.
  await openEventTab(page, "Budget");
  await page.getByRole("link", { name: "Proposer des montants estimés, historique et devis joints" }).click();
  await page.getByLabel("Budget total (€)").fill("10000");
  await page.getByLabel("Nombre d'invités").fill("40");
  await page.getByLabel("Modèle de répartition").selectOption({ label: "Classique" });
  await page.getByRole("button", { name: "Simuler" }).click();
  await expect(page.getByText("250,00 €", { exact: false })).toBeVisible();

  // Pas encore de bandeau avant confirmation (événement toujours prospect).
  await page.goto(eventUrl);
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Faire de la simulation le budget estimé" })).toHaveCount(0);

  // Passage en Confirmé → le bandeau apparaît.
  await changeEventStatus(page, "Confirmé");
  await expect(page.getByRole("heading", { name: "Faire de la simulation le budget estimé" })).toBeVisible();
  await expectNoAxeViolation(page);

  await page.getByRole("button", { name: "En faire le budget estimé" }).click();
  await expect(page.getByRole("heading", { name: "Faire de la simulation le budget estimé" })).toHaveCount(0);

  // PRD-BUD-02, BUD-01 (lot 28a) : tableau des cinq montants et de l'écart.
  await page.goto(`${eventUrl}`.replace("/events/", "/budget/"));
  await expectNoAxeViolation(page);
  const table = page.getByRole("table", { name: "Estimé, devisé, engagé, payé" });
  await expect(table).toBeVisible();
  // Lot 28b : la ligne (pas le total de sa catégorie), repérée par « Modifier ».
  const lieuRow = table.getByRole("row").filter({ hasText: "Modifier « Lieu de réception »" });
  await expect(lieuRow).toContainText("6 000,00 €");
  await expect(lieuRow).toContainText("Non renseigné");

  // Modification de l'engagé à la main, écart calculé (6000 € estimés, 7000 € engagés).
  await lieuRow.getByText("Modifier « Lieu de réception »").click();
  // Lot 28b : le formulaire s'ouvre dans une rangée pleine largeur, sous la ligne.
  const editor = page.getByRole("region", { name: "Ligne « Lieu de réception » : montants, prestataire, documents et échéances" });
  await editor.getByLabel("Engagé — Lieu de réception").fill("7000");
  await editor.getByRole("button", { name: "Enregistrer la ligne" }).click();
  await expect(lieuRow).toContainText("Dépassement de 1 000,00 €");
  await expectNoAxeViolation(page);
});
