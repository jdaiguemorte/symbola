// AIDE-01/02, lot 4 — visites guidées des modules Devis et Budget (première
// ouverture, relance par « ? »), puis essai guidé du module Devis : devis
// fictif signé sur la page de signature d'essai (aucun e-mail à un tiers),
// facture DEMO, tout supprimé à la fin de l'essai. Ordinateur et 375 px,
// axe-core sur chaque écran.
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

async function newPlanner(page: Page, tag: string) {
  const email = `planner-${tag}-${randomUUID()}@symbola.test`;
  const password = `mot-de-passe-${tag}-e2e`;
  const { sql, db } = createAppConnection();
  try {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await saveOnboardingStep(db, organization.id, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, address: "1 rue des Lilas" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);
}

test("AIDE-01 — visites guidées des modules Devis et Budget, relançables depuis « ? »", async ({ page }) => {
  test.setTimeout(90_000);
  await newPlanner(page, "tours");

  await page.goto("/devis/catalogue");
  await page.waitForLoadState("networkidle");
  const tour = page.getByRole("dialog");
  await expect(tour).toHaveAccessibleName("Votre catalogue");
  await expectNoAxeViolation(page);
  await tour.getByRole("button", { name: "Suivant" }).click();
  await expect(tour).toHaveAccessibleName("Composer un devis");
  await tour.getByRole("button", { name: "Passer" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator('summary[aria-label="Catalogue des prestations"]').click();
  await page.getByRole("button", { name: "Relancer la visite guidée" }).click();
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Votre catalogue");
  await page.getByRole("dialog").getByRole("button", { name: "Passer" }).click();

  await page.goto("/budget/parametres");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("dialog")).toHaveAccessibleName("Vos modèles de budget");
  await expectNoAxeViolation(page);
  await page.getByRole("dialog").getByRole("button", { name: "Passer" }).click();
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("AIDE-02 — essai guidé du module Devis : devis fictif signé et facturé, supprimé avec l'essai", async ({ page }) => {
  test.setTimeout(150_000);
  await newPlanner(page, "essai-devis");

  await page.goto("/events");
  await page.waitForLoadState("networkidle");
  await page.getByRole("dialog").getByRole("button", { name: "Passer" }).click();
  await page.getByRole("button", { name: "Démarrer l'essai" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  const trialUrl = page.url();
  await expect(page.getByText(/Composez un devis fictif/)).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Essayer un devis fictif" }).click();
  await expect(page).toHaveURL(/\/devis\/[0-9a-f-]{36}$/);
  const quoteUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Devis DEMO-D-\d{4}-0001$/);
  await expect(page.getByText("Devis d'essai : données fictives, numéroté dans la série DEMO.")).toBeVisible();
  await expect(page.getByRole("table", { name: "Lignes de la version 1" }).getByRole("row", { name: /Coordination du jour J/ })).toBeVisible();
  await expectNoAxeViolation(page);

  // Signature par les mariés fictifs, sur la page de signature d'essai.
  await page.waitForLoadState("networkidle");
  const send = page.getByRole("form", { name: "Envoyer en signature" });
  for (const [index, group] of (await send.getByRole("group").all()).entries()) {
    await group.getByLabel("E-mail").fill(`marie-fictif-${index}-${randomUUID()}@symbola.test`);
    await group.getByLabel("Adresse de facturation").fill("12 rue du Lac, 74000 Annecy");
  }
  await send.getByRole("button", { name: "Envoyer en signature" }).click();
  await expect(page.getByText("En attente de signature.")).toBeVisible();
  const links = await page.getByRole("link", { name: /^lien de signature de / }).all();
  const hrefs = await Promise.all(links.map((link) => link.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    await page.goto(new URL(href!).pathname);
    await expect(page.getByText(/Signature fictive/)).toBeVisible();
    await page.getByRole("button", { name: "Signer le devis" }).click();
    await expect(page.getByText("Vous avez signé ce devis.")).toBeVisible();
  }

  // Facture fictive (série DEMO, en filigrane).
  await page.goto(quoteUrl);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Devis signé par tous les signataires.")).toBeVisible();
  await page.getByRole("button", { name: "Émettre la facture d'acompte « Acompte à la signature »" }).click();
  await expect(page.getByText(/^DEMO-F-\d{4}-0001 — Facture d'acompte/)).toBeVisible();
  const pdf = await page.request.get((await page.getByRole("link", { name: /^PDF de la facture DEMO-F-/ }).getAttribute("href"))!);
  expect(pdf.status()).toBe(200);
  await expectNoAxeViolation(page);

  // Fin de l'essai : le devis fictif et sa facture disparaissent.
  await page.goto(trialUrl);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Terminer l'essai et supprimer ses données" }).click();
  await expect(page).toHaveURL(/\/events\?essai=termine$/);
  await page.goto(quoteUrl);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page introuvable");
});
