// BUD-01 — modèles de répartition (total 100 % obligatoire), simulation
// pour un prospect (montant par poste, coût par invité), ajustement d'un
// poste à la main. En taille ordinateur et en 375 px, axe-core sur chaque
// écran.
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

test("BUD-01 — modèle de répartition, simulation et ajustement d'un poste", async ({ page }) => {
  const email = `planner-bud01-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-bud01-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Postes prestataires par défaut (EVT-03, prérequis du modèle de
  // répartition) puis source (EVT-07, prérequis de la création d'un
  // prospect).
  await page.goto("/events/parametres");
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await page.getByLabel("Nouvelle source").fill("Instagram");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Instagram" })).toBeVisible();

  // BUD-01 : un modèle dont le total ne fait pas 100 % est refusé.
  await page.goto("/budget/parametres");
  await page.getByLabel("Nom du modèle").fill("Incomplet");
  await page.getByLabel("Lieu de réception %").fill("50");
  await page.getByRole("button", { name: "Créer le modèle" }).click();
  await expect(page.getByText("Le total des pourcentages doit faire exactement 100 %.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Un modèle valide est accepté et listé.
  await page.getByLabel("Nom du modèle").fill("Classique");
  await page.getByLabel("Lieu de réception %").fill("60");
  await page.getByLabel("Traiteur %").fill("40");
  await page.getByRole("button", { name: "Créer le modèle" }).click();
  await expect(page.getByText("Modèle créé.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "Classique" })).toBeVisible();

  // Création du prospect (EVT-07).
  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Camille");
  await page.getByLabel("Source du prospect").selectOption({ label: "Instagram" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page.getByRole("heading", { name: "Camille" })).toBeVisible();

  // BUD-01 : accès à la simulation depuis la fiche événement.
  await page.getByRole("link", { name: "Budget" }).click();
  await expect(page).toHaveURL(/\/budget\//);
  await expectNoAxeViolation(page);

  await page.getByLabel("Budget total (€)").fill("10000");
  await page.getByLabel("Nombre d'invités").fill("40");
  await page.getByLabel("Modèle de répartition").selectOption({ label: "Classique" });
  await page.getByRole("button", { name: "Simuler" }).click();

  await expect(page.getByText("250,00 €", { exact: false })).toBeVisible();

  // Ajustement d'un poste à la main (EVT-03/BUD-01 : le reste à répartir
  // se recalcule) — scopé à la ligne « Lieu de réception », l'ordre des
  // postes n'étant pas garanti.
  const lieuItem = page.getByRole("listitem").filter({ has: page.getByLabel("Lieu de réception", { exact: true }) });
  await lieuItem.getByLabel("Lieu de réception", { exact: true }).fill("7000");
  await lieuItem.getByRole("button", { name: "Ajuster" }).click();
  await expect(page.getByText(/^Reste à répartir : /)).toBeVisible();
  await expectNoAxeViolation(page);
});
