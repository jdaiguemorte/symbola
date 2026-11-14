// AIDE-11/02 — repères des modules Devis et Budget (affichés d’office à la
// première ouverture, rouverts par « ? »), puis essai guidé du module Devis : devis
// fictif signé sur la page de signature d'essai (aucun e-mail à un tiers),
// facture DEMO, tout supprimé à la fin de l'essai. Ordinateur et 375 px,
// axe-core sur chaque écran.
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createAppConnection } from "@symbola/db/client";
import { createUser } from "@symbola/auth";
import { expect, test, type Page } from "@playwright/test";
import { saveOnboardingStep } from "../modules/hub/service";
import { closeLandmarks, landmarksPanel, readyOrganization, signIn as signInByLink } from "./helpers";

async function loginAndSetupMfa(page: Page, email: string, _password: string) {
  // Lot 33 : lien magique et fournisseur d'identité (e2e/helpers.ts).
  await signInByLink(page, email, "/");
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
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
    await saveOnboardingStep(db, organization.id, { vatRegime: "franchise", vatRateDefaultBasisPoints: null, address: "1 rue des Lilas" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);
}

// Repères ouverts d'office (sans la préférence posée par la
// configuration des autres parcours).
test.use({ storageState: { cookies: [], origins: [] } });

test("AIDE-11 — repères des modules Devis et Budget, rouverts depuis « ? »", async ({ page }) => {
  test.setTimeout(90_000);
  await newPlanner(page, "tours");

  await page.goto("/devis/catalogue");
  const catalog = landmarksPanel(page, "Catalogue des prestations");
  await expect(catalog).toBeVisible();
  await expect(catalog.getByRole("heading", { name: "Le catalogue", level: 3 })).toBeVisible();
  await expectNoAxeViolation(page);
  // Lot 20 (AIDE-15) : deux repères, chacun sur un élément de l'écran.
  await catalog.getByRole("button", { name: "Repère suivant" }).click();
  await expect(catalog.getByRole("heading", { name: "Nouvel article", level: 3 })).toBeVisible();
  await expect(catalog.getByRole("button", { name: "Repère suivant" })).toBeDisabled();
  await closeLandmarks(page, "Catalogue des prestations");
  await page.reload();
  await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
  await expect(catalog).toHaveCount(0);
  await page.getByRole("button", { name: "Aide sur cet écran" }).click();
  await expect(catalog.getByRole("heading", { name: "Le catalogue", level: 3 })).toBeVisible();
  await closeLandmarks(page, "Catalogue des prestations");

  await page.goto("/budget/parametres");
  const budget = landmarksPanel(page, "Répartition du budget");
  await expect(budget.getByRole("heading", { name: "Vos répartitions", level: 3 })).toBeVisible();
  await budget.getByRole("button", { name: "Repère suivant" }).click();
  await expect(budget.getByRole("heading", { name: "Nouveau modèle", level: 3 })).toBeVisible();
  await expectNoAxeViolation(page);
  await closeLandmarks(page, "Répartition du budget");
  await page.reload();
  await expect(page.getByRole("button", { name: "Aide sur cet écran" })).toBeVisible();
  await expect(budget).toHaveCount(0);
});

test("AIDE-02 — essai guidé du module Devis : devis fictif signé et facturé, supprimé avec l'essai", async ({ page }) => {
  test.setTimeout(150_000);
  await newPlanner(page, "essai-devis");

  await page.goto("/events");
  await closeLandmarks(page, "Liste des événements");
  // Lot 20 (décision 2) : l'essai se lance depuis l'aide de l'écran.
  await page.getByRole("button", { name: "Aide sur cet écran" }).click();
  await landmarksPanel(page, "Liste des événements").getByRole("button", { name: "Démarrer l'essai" }).click();
  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  // Les repères de la fiche s'affichent d'eux-mêmes ; ce parcours les ferme.
  await closeLandmarks(page, "Fiche de l'événement");
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
