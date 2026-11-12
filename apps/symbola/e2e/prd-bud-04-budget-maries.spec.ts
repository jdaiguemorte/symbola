// PRD-BUD-04 — le marié invité voit le budget de son événement (poste, estimé,
// engagé, écart, totaux) en lecture seule, sans aucun formulaire, et les
// écrans budget de la planner lui restent fermés. En taille ordinateur et
// en 375 px, axe-core sur chaque écran.
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

test("PRD-BUD-04 — le marié consulte le budget de son événement en lecture seule", async ({ page, browser }) => {
  test.setTimeout(150_000);
  const email = `planner-bud04-${randomUUID()}@symbola.test`;
  const password = "mot-de-passe-bud04-e2e";
  const { sql, db } = createAppConnection();
  try {
    const organization = await readyOrganization(db, `Org ${randomUUID()}`);
    await createUser(db, { organizationId: organization.id, email, password, role: "owner" });
  } finally {
    await sql.end();
  }
  await loginAndSetupMfa(page, email, password);

  // Prérequis (même parcours que PRD-BUD-02) : postes, source, modèle, budget estimé.
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
  await page.goto(eventUrl);
  await page.waitForLoadState("networkidle");
  await changeEventStatus(page, "Confirmé");
  await page.getByRole("button", { name: "En faire le budget estimé" }).click();
  await expect(page.getByRole("heading", { name: "Faire de la simulation le budget estimé" })).toHaveCount(0);

  // La planner saisit un engagé sur le lieu (6 000 € estimés, 7 000 € engagés).
  const eventId = eventUrl.split("/").pop()!;
  await page.goto(`/budget/${eventId}`);
  await page.waitForLoadState("networkidle");
  // Lot 28b : la ligne (pas le total de sa catégorie), repérée par « Modifier ».
  const plannerRow = page.getByRole("table", { name: "Estimé, devisé, engagé, payé" }).getByRole("row").filter({ hasText: "Modifier « Lieu de réception »" });
  await plannerRow.getByText("Modifier « Lieu de réception »").click();
  // Lot 28b : le formulaire s'ouvre dans une rangée pleine largeur, sous la ligne.
  const editor = page.getByRole("region", { name: "Ligne « Lieu de réception » : montants, prestataire, documents et échéances" });
  await editor.getByLabel("Engagé — Lieu de réception").fill("7000");
  await editor.getByRole("button", { name: "Enregistrer la ligne" }).click();
  await expect(plannerRow).toContainText("Dépassement de 1 000,00 €");

  // Lot 26a : elle crée le lien personnel du marié depuis la fiche ; le lien
  // n'est montré qu'une fois.
  await page.goto(eventUrl);
  await page.waitForLoadState("networkidle");
  await openEventTab(page, "Mariés");
  await page.getByLabel("Nom de la personne").fill("Inès");
  await page.getByLabel("E-mail de la personne").fill(`marie-bud04-${randomUUID()}@symbola.test`);
  await page.getByRole("button", { name: "Créer le lien et l'envoyer" }).click();
  const coupleUrl = await page.getByLabel("Lien personnel de Inès").inputValue();
  expect(coupleUrl).toMatch(/\/lien#[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}$/);

  const coupleContext = await browser.newContext({ locale: "fr-FR", viewport: page.viewportSize() });
  const couple = await coupleContext.newPage();
  await couple.goto(coupleUrl);
  await expect(couple).toHaveURL(/\/portail$/);

  // PRD-BUD-04 : le budget apparaît dans son portail, en lecture seule.
  const budget = couple.getByRole("region", { name: "Budget" });
  const table = budget.getByRole("table", { name: "Estimé, engagé, écart" });
  const coupleRow = table.getByRole("row", { name: /Lieu de réception/ });
  await expect(coupleRow).toContainText("6 000,00 €");
  await expect(coupleRow).toContainText("7 000,00 €");
  await expect(coupleRow).toContainText("Dépassement de 1 000,00 €");
  await expect(budget.getByRole("textbox")).toHaveCount(0);
  await expect(budget.getByRole("spinbutton")).toHaveCount(0);
  await expect(budget.getByRole("button")).toHaveCount(0);
  await expectNoAxeViolation(couple);

  // Les écrans budget de la planner lui restent fermés (il n'a pas de compte).
  await couple.goto(`/budget/${eventId}`);
  await expect(couple).toHaveURL(/\/login$/);
  await couple.goto("/budget/parametres");
  await expect(couple).toHaveURL(/\/login$/);
  await coupleContext.close();
});
