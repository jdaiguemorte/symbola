// DEV-01 — catalogue, composition d'un devis depuis la fiche d'un
// événement, envoi (version figée), PDF, puis nouvelle version. En taille
// ordinateur et en 375 px, axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { saveOnboardingStep } from "../modules/hub/service";

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

test("DEV-01 — composer un devis depuis un événement, l'envoyer, le télécharger et en créer une V2", async ({ page }) => {
  test.setTimeout(120_000);
  const email = `planner-dev01-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-dev01-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await saveOnboardingStep(db, organization.id, {
      vatRegime: "assujetti",
      vatRateDefaultBasisPoints: 2000,
      siren: "123456789",
      address: "1 rue des Lilas, 69001 Lyon",
    });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Paramètres : validité par défaut, préfixes.
  await page.goto("/devis/parametres");
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Validité d'un devis (jours)")).toHaveValue("30");
  await page.getByLabel("Validité d'un devis (jours)").fill("45");
  await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
  await expect(page.getByText("Paramètres enregistrés.")).toBeVisible();
  await expectNoAxeViolation(page);

  // Catalogue : un article.
  await page.goto("/devis/catalogue");
  await page.waitForLoadState("networkidle");
  const newItem = page.getByRole("form", { name: "Nouvel article" });
  await newItem.getByLabel("Intitulé").fill("Coordination jour J");
  await newItem.getByLabel("Unité").fill("forfait");
  await newItem.getByLabel("Prix unitaire HT (€)").fill("1500");
  await expect(newItem.getByLabel("Taux de TVA (%)")).toHaveValue("20");
  await newItem.getByLabel("Catégorie").fill("Prestations");
  await newItem.getByRole("button", { name: "Ajouter l'article" }).click();
  await expect(page.getByText("Article ajouté.")).toBeVisible();
  await expect(page.getByText("Coordination jour J", { exact: true })).toBeVisible();
  await expectNoAxeViolation(page);

  // Un prospect, puis le devis depuis sa fiche.
  await page.goto("/events/parametres");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Nouvelle source").fill("Salon");
  await page.getByRole("button", { name: "Ajouter la source" }).click();
  await expect(page.getByText("Source ajoutée.")).toBeVisible();
  await page.goto("/events/new");
  await page.getByLabel("Prénom du premier marié", { exact: true }).fill("Inès");
  await page.getByLabel("Source du prospect").selectOption({ label: "Salon" });
  await page.getByRole("button", { name: "Créer le prospect" }).click();
  await expect(page.getByRole("heading", { name: "Inès" })).toBeVisible();
  await expect(page.getByText("Aucun devis pour cet événement.")).toBeVisible();
  await page.getByRole("button", { name: "Créer un devis" }).click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  const quoteUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Devis D-\d{4}-0001$/);
  await page.waitForLoadState("networkidle");

  // Composition : un article du catalogue et une ligne libre ; les totaux
  // sont recalculés côté serveur.
  const fromCatalog = page.getByRole("form", { name: "Ajouter un article du catalogue" });
  await fromCatalog.getByLabel("Article").selectOption({ label: "Prestations — Coordination jour J" });
  await fromCatalog.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(fromCatalog.getByText("Ligne ajoutée.")).toBeVisible();
  const freeLine = page.getByRole("form", { name: "Ajouter une ligne libre" });
  await freeLine.getByLabel("Intitulé").fill("Déplacement");
  await freeLine.getByLabel("Unité").fill("forfait");
  await freeLine.getByLabel("Prix unitaire HT (€)").fill("200");
  await freeLine.getByRole("button", { name: "Ajouter la ligne" }).click();
  await expect(freeLine.getByText("Ligne ajoutée.")).toBeVisible();
  const lines = page.getByRole("table", { name: "Lignes de la version 1" });
  await expect(lines.getByRole("row", { name: /Déplacement/ })).toBeVisible();
  await expect(page.getByText(/^2\s040,00\s€$/)).toBeVisible();
  await expectNoAxeViolation(page);

  // Envoi : la version 1 est figée, valable 45 jours.
  await page.getByRole("button", { name: "Marquer comme envoyé" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Devis envoyé : cette version est figée." })).toBeVisible();
  await expect(page.getByText(/^Statut : Envoyé/)).toBeVisible();
  await expect(page.getByText(/^Valable jusqu'au/)).toBeVisible();
  await expect(page.getByRole("form", { name: "Ajouter une ligne libre" })).toHaveCount(0);
  const pdf = await page.request.get(`${new URL(quoteUrl).pathname}/pdf?version=1`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  // Modifier un devis envoyé crée la version 2 ; la version 1 reste consultable.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Créer une nouvelle version" }).click();
  await expect(page.getByText(/^Statut : Brouillon — Version 2/)).toBeVisible();
  await expect(page.getByRole("form", { name: "Ajouter une ligne libre" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Versions précédentes" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Télécharger le PDF (version 1)" })).toBeVisible();
  await expectNoAxeViolation(page);

  // La fiche de l'événement liste le devis.
  await page.getByRole("link", { name: "Inès" }).click();
  await expect(page.getByRole("link", { name: /^D-\d{4}-0001$/ })).toBeVisible();
});
