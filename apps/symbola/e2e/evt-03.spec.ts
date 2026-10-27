// EVT-03 — postes prestataires : liste par défaut (modèle de départ),
// barre d'avancement, statut Réservé avec prestataire obligatoire et
// montant facultatif, postes modifiables événement par événement. En
// taille ordinateur et en 375 px, axe-core sur chaque écran.
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

test("EVT-03 — postes par défaut, barre d'avancement et réservation d'un prestataire", async ({ page }) => {
  const email = `planner-evt03-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-evt03-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Liste par défaut : modèle de départ, puis ajustement.
  await page.goto("/events/parametres");
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await expect(page.getByText("12 postes ajoutés depuis le modèle de départ.")).toBeVisible();
  await page.getByRole("button", { name: "Retirer le poste « Transport des invités »" }).click();
  await expect(page.getByRole("button", { name: "Retirer le poste « Transport des invités »" })).toHaveCount(0);
  await page.getByRole("button", { name: "Charger le modèle de départ" }).click();
  await expect(page.getByText("1 poste ajouté depuis le modèle de départ.")).toBeVisible();
  await page.getByRole("button", { name: "Retirer le poste « Transport des invités »" }).click();
  await expect(page.getByRole("button", { name: "Retirer le poste « Transport des invités »" })).toHaveCount(0);
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Un nouvel événement reçoit les 11 postes par défaut.
  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Camille");
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Aucun poste réservé sur 11")).toBeVisible();
  await expectNoAxeViolation(page);

  // Réservé exige le nom du prestataire ; le montant est facultatif.
  const photographer = page.getByRole("group", { name: "Photographe" });
  await photographer.getByLabel("Statut du poste").selectOption("booked");
  await photographer.getByRole("button", { name: "Enregistrer le poste" }).click();
  await expect(photographer.getByText("Indiquez le nom du prestataire pour un poste réservé.")).toBeVisible();
  await photographer.getByLabel("Prestataire (obligatoire si Réservé)").fill("Studio Lumière");
  await photographer.getByLabel("Montant en euros (facultatif)").fill("2 500,50");
  await photographer.getByRole("button", { name: "Enregistrer le poste" }).click();
  await expect(photographer.getByText("Poste enregistré.")).toBeVisible();
  await expect(page.getByText("1 poste réservé sur 11")).toBeVisible();
  const photographerItem = page.getByRole("listitem").filter({ has: photographer });
  await expect(photographerItem).toContainText("Réservé — Studio Lumière");
  await expect(photographerItem).toContainText(/2\s500,50\s€/);

  // Un poste « Non requis » sort du compte des postes requis.
  const videographer = page.getByRole("group", { name: "Vidéaste" });
  await videographer.getByLabel("Statut du poste").selectOption("not_required");
  await videographer.getByRole("button", { name: "Enregistrer le poste" }).click();
  await expect(videographer.getByText("Poste enregistré.")).toBeVisible();
  await expect(page.getByText("1 poste réservé sur 10")).toBeVisible();

  // Postes modifiables événement par événement.
  await page.getByLabel("Nouveau poste pour cet événement").fill("Wedding designer");
  await page.getByRole("button", { name: "Ajouter le poste", exact: true }).click();
  await expect(page.getByRole("group", { name: "Wedding designer" })).toBeVisible();
  await page.getByRole("button", { name: "Retirer le poste « Papeterie »" }).click();
  await expect(page.getByRole("group", { name: "Papeterie" })).toHaveCount(0);
  await expect(page.getByText("1 poste réservé sur 10")).toBeVisible();
  await expectNoAxeViolation(page);
});
