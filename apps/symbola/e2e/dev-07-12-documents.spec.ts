// Lot 17 (DEV-07 à DEV-11) — devis et factures à son image : coordonnées dans
// Entreprise et TVA, logo, couleur, police, textes et IBAN dans Paramètres ›
// Ventes › Documents, aperçu en direct, PDF d'exemple ; une autre
// organisation ne reçoit ni le logo ni les réglages. En taille ordinateur et
// en 375 px, axe-core sur chaque écran. Les copies figées (DEV-12) sont
// couvertes par modules/quotes/documents.integration.test.ts.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { logout, openSettingsTab, readyOrganization, signIn as signInByLink } from "./helpers";
import { saveOnboardingStep } from "../modules/hub/service";

// Image PNG 1 × 1 : le plus petit logo valide.
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
}

async function expectNoAxeViolation(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
}

async function plannerAccount(name: string) {
  const email = `planner-dev17-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-dev17-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, name);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await saveOnboardingStep(db, organization.id, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, legalForm: "ei", address: "1 rue des Lilas, 69001 Lyon", siren: "123456789" });
  } finally {
    await sql.end();
  }
  return { email, password };
}

test("DEV-07 à DEV-11 — régler le logo, l'apparence, les textes et l'IBAN des documents, avec l'aperçu et un PDF d'exemple", async ({ page }, testInfo) => {
  test.setTimeout(150_000);
  const atelier = await plannerAccount("Atelier Lumière");
  const other = await plannerAccount(`Org ${randomUUID()}`);
  await loginAndSetupMfa(page, atelier.email, atelier.password);

  // DEV-07 : coordonnées imprimées, dans Entreprise et TVA.
  await openSettingsTab(page, "Entreprise et TVA");
  await page.waitForLoadState("networkidle");
  const details = page.getByRole("form", { name: "Coordonnées des devis et factures" });
  await details.getByLabel("SIRET (14 chiffres)").fill("1234");
  await details.getByRole("button", { name: "Enregistrer les coordonnées" }).click();
  await expect(details.getByRole("alert")).toHaveText("Le SIRET doit compter 14 chiffres.");
  await details.getByLabel("SIRET (14 chiffres)").fill("123 456 789 00012");
  await details.getByLabel("E-mail de contact").fill("bonjour@atelier.example");
  await details.getByLabel("Numéro de TVA intracommunautaire").fill("FR40123456789");
  await details.getByRole("button", { name: "Enregistrer les coordonnées" }).click();
  await expect(details.getByRole("status")).toHaveText("Coordonnées enregistrées.");
  await expectNoAxeViolation(page);

  // DEV-08 : un fichier qui n'est pas une image est refusé, un PNG devient le logo.
  await openSettingsTab(page, "Documents");
  await expect(page.getByRole("heading", { level: 1, name: "Documents" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const logoField = page.getByLabel("Choisir une image (PNG ou JPEG, 2 Mo au plus)");
  await logoField.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from("pas une image") });
  await page.getByRole("button", { name: "Envoyer le logo" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Le logo doit être une image PNG ou JPEG.");
  await logoField.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG_1PX });
  await page.getByRole("button", { name: "Envoyer le logo" }).click();
  const logo = page.getByRole("img", { name: "Logo actuel de votre entreprise" });
  await expect(logo).toBeVisible();
  const served = await page.request.get((await logo.getAttribute("src"))!);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/png");

  // DEV-09 et DEV-10 : l'aperçu suit la couleur, la police et les textes.
  const preview = page.getByRole("region", { name: "Aperçu du document, avec des données d'exemple" });
  await expect(preview).toContainText("Atelier Lumière EI");
  await expect(preview).toContainText("SIRET 12345678900012");
  await page.getByLabel("Terracotta").check();
  await page.getByLabel("Classique").check();
  await page.getByLabel("Introduction du devis").fill("Voici notre proposition pour votre mariage.");
  await expect(preview).toContainText("Voici notre proposition pour votre mariage.");

  // DEV-11 : un IBAN dont la clé est fausse est refusé, puis un IBAN valide.
  await page.getByLabel("IBAN", { exact: true }).fill("FR76 3000 6000 0112 3456 7890 188");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText("Cet IBAN n'est pas valide : sa clé de contrôle ne correspond pas.");
  await page.getByLabel("IBAN", { exact: true }).fill("FR76 3000 6000 0112 3456 7890 189");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.locator("main").getByRole("status")).toHaveText("Réglages enregistrés. Les documents déjà émis ne changent pas.");
  await expect(preview).toContainText("Échéancier");
  await expect(preview).toContainText("IBAN FR76 3000 6000 0112 3456 7890 189");
  await page.getByRole("button", { name: "Facture", exact: true }).click();
  await expect(preview).toContainText("Reste à payer");
  await expect(preview).toContainText(/Référence à rappeler : F-\d{4}-0002/);
  await expectNoAxeViolation(page);
  await page.screenshot({ path: testInfo.outputPath("documents.png"), fullPage: true });

  // PDF d'exemple : rien n'est créé.
  for (const type of ["devis", "facture"]) {
    const pdf = await page.request.get(`/devis/parametres/documents/exemple?type=${type}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString("latin1")).toBe("%PDF-");
  }

  // Isolation : l'autre organisation n'a ni ce logo ni ces réglages.
  await logout(page);
  await loginAndSetupMfa(page, other.email, other.password);
  expect((await page.request.get("/logo")).status()).toBe(404);
  await page.goto("/devis/parametres/documents");
  await expect(page.getByLabel("IBAN", { exact: true })).toHaveValue("");
  await expect(page.getByRole("region", { name: "Aperçu du document, avec des données d'exemple" })).not.toContainText("Atelier Lumière");
});

test("DEV-08 — sans session, le logo n'est pas servi", async ({ request }) => {
  expect((await request.get("/logo")).status()).toBe(401);
});
